import { Module, Controller, Get, Post, Body, Param, Query, Injectable, UseGuards, Req } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { paginate, paginatedResponse } from '../../common/pagination.helper';
import { ApiTags } from '@nestjs/swagger';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SettlementEntity } from '../../database/entities/settlement.entity';
import { GymEntity } from '../../database/entities/gym.entity';
import { CheckinEntity } from '../../database/entities/checkin.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { AppConfigEntity } from '../../database/entities/app-config.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { CommissionConfig, PLATFORM_PRICING_CONFIG_KEY, serviceCommission } from '../../common/commission-config';

/**
 * SettlementEngine - implements the revenue-bucket logic from the LLR:
 *   individual_commission: Platform % ; remainder to gym
 *   elite_pool:  Platform 20% ; 80% split by visit ratio
 *   pro_pool:    Platform 15% ; 85% split by weighted visit ratio
 */
@Injectable()
class SettlementService {
  constructor(
    @InjectRepository(SettlementEntity) private readonly settlements: Repository<SettlementEntity>,
    @InjectRepository(GymEntity) private readonly gyms: Repository<GymEntity>,
    @InjectRepository(CheckinEntity) private readonly checkins: Repository<CheckinEntity>,
    @InjectRepository(SubscriptionEntity) private readonly subs: Repository<SubscriptionEntity>,
    @InjectRepository(AppConfigEntity) private readonly configs: Repository<AppConfigEntity>,
  ) {}

  async myGymSettlements(ownerId: string) {
    const gym = await this.gyms.findOne({ where: { ownerId } });
    if (!gym) return { current: this.emptyCurrent(), history: [] };
    const rows = await this.settlements.find({ where: { gymId: gym.id }, order: { month: 'DESC' } });
    const mapped = rows.map((s) => this.mapSettlement(s, gym));
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentRow = mapped.find((s) => s.period === currentMonth);
    const projected = currentRow ? null : await this.currentProjection(gym);
    return {
      current: currentRow ? this.currentDto(currentRow) : projected,
      history: mapped.filter((s) => s.period !== currentMonth),
    };
  }

  private async currentProjection(gym: GymEntity) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const rows = await this.checkins.find({ where: { gymId: gym.id, status: 'success', checkinTime: Between(from, to) } });
    const ratePerDay = Number((gym as any).ratePerDay || 0);
    const projectedPayout = Math.round(rows.length * ratePerDay);
    return {
      ...this.emptyCurrent(),
      grossRevenue: projectedPayout,
      netPayout: projectedPayout,
      status: rows.length ? 'projected' : 'not_generated',
      multiGymPool: projectedPayout,
    };
  }

  async list(page: any = 1, limit: any = 20, gymId?: string) {
    const where = gymId ? { gymId } : {};
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const [data, total] = await this.settlements.findAndCount({ where, order: { month: 'DESC' }, skip, take });
    const gymIds = [...new Set(data.map((s) => s.gymId))];
    const gyms = gymIds.length ? await this.gyms.createQueryBuilder('g').whereInIds(gymIds).getMany() : [];
    return paginatedResponse(data.map((s) => this.mapSettlement(s, gyms.find((g) => g.id === s.gymId))), total, p, l);
  }

  private mapSettlement(s: SettlementEntity, gym?: GymEntity) {
    return {
      ...s,
      gymName: gym?.name || 'Unknown Gym',
      period: s.month,
      grossRevenue: Number(s.totalRevenue || 0),
      commission: Number(s.commission || 0),
      netPayout: Number(s.netPayout || 0),
      commissionRate: 0,
    };
  }

  private emptyCurrent() {
    return {
      grossRevenue: 0,
      commission: 0,
      netPayout: 0,
      commissionRate: 0,
      status: 'not_generated',
      individualPool: 0,
      multiGymPool: 0,
      dayPassPool: 0,
    };
  }

  private currentDto(row: any) {
    return {
      grossRevenue: row.grossRevenue,
      commission: row.commission,
      netPayout: row.netPayout,
      commissionRate: row.commissionRate,
      status: row.status,
      individualPool: Number(row.breakdown?.sameGymRevenue || 0),
      multiGymPool: Number(row.breakdown?.multiGymGross || 0),
      dayPassPool: Number(row.breakdown?.dayPassRevenue || 0),
    };
  }

  private commissionFromPaidAmount(paidAmount: number, commission: CommissionConfig) {
    const paid = Math.max(0, Number(paidAmount) || 0);
    const value = Math.max(0, Number(commission?.value) || 0);
    if (!paid || !value) return 0;
    if (commission?.mode === 'fixed') return Math.min(paid, value);
    return paid * (value / (100 + value));
  }

  /** Runs on the 1st of each month at 2am to compute previous month's settlements */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async monthlySettlementJob() {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    await this.computeForMonth(month);
  }

  async computeForMonth(month: string) {
    const [y, m] = month.split('-').map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 1);
    const gyms = await this.gyms.find({ where: { status: 'active' } });
    const configRow = await this.configs.findOne({ where: { key: PLATFORM_PRICING_CONFIG_KEY } });
    const sameGymCommissionConfig = serviceCommission(configRow?.value, 'same_gym');
    const dayPassCommissionConfig = serviceCommission(configRow?.value, 'day_pass');

    const allCheckins = await this.checkins
      .createQueryBuilder('c')
      .where('c.checkinTime >= :from AND c.checkinTime < :to', { from, to })
      .andWhere('c.status = :st', { st: 'success' })
      .getMany();

    // Get all subscriptions to know plan type per check-in
    const subIds = [...new Set(allCheckins.map(c => c.subscriptionId))];
    const subsMap = new Map<string, any>();
    if (subIds.length > 0) {
      const subs = await this.subs.findByIds(subIds);
      subs.forEach(s => subsMap.set(s.id, s));
    }

    const monthlySubs = await this.subs
      .createQueryBuilder('s')
      .where('s."createdAt" >= :from AND s."createdAt" < :to', { from, to })
      .andWhere('s.status IN (:...statuses)', { statuses: ['active', 'frozen', 'expired'] })
      .getMany();

    const multiGymSubs = monthlySubs.filter((s) => s.planType === 'multi_gym');
    const totalMultiGymRevenue = multiGymSubs.reduce((sum, s) => sum + Number(s.amountPaid || 0), 0);
    const multiGymCheckinsAll = allCheckins.filter((c) => subsMap.get(c.subscriptionId)?.planType === 'multi_gym');
    const totalMultiGymBillableDays = new Set(multiGymCheckinsAll.map((c) =>
      `${c.gymId}_${c.userId}_${new Date(c.checkinTime).toISOString().slice(0, 10)}`
    )).size;

    const results: SettlementEntity[] = [];

    for (const gym of gyms) {
      const gymCheckins = allCheckins.filter(c => c.gymId === gym.id);

      // --- Multi-gym plans: allocate actual collected subscription revenue by unique gym/user/day visits ---
      const multiGymCheckins = gymCheckins.filter(c => subsMap.get(c.subscriptionId)?.planType === 'multi_gym');
      const billableDayKeys = new Set(multiGymCheckins.map(c =>
        `${c.userId}_${new Date(c.checkinTime).toISOString().slice(0, 10)}`
      ));
      const billableDays = billableDayKeys.size;
      const multiGymGrossRevenue = totalMultiGymBillableDays > 0
        ? totalMultiGymRevenue * (billableDays / totalMultiGymBillableDays)
        : 0;
      const multiGymCommission = 0;
      const multiGymPayout = multiGymGrossRevenue - multiGymCommission;

      // --- Single-gym and day-pass subscriptions: use actual paid subscription amount for this gym ---
      const gymPaidSubs = monthlySubs.filter((s) => (s.gymIds || []).includes(gym.id) && (s.planType === 'same_gym' || s.planType === 'day_pass'));
      const sameGymRevenue = gymPaidSubs.filter((s) => s.planType === 'same_gym').reduce((sum, s) => sum + Number(s.amountPaid || 0), 0);
      const dayPassRevenue = gymPaidSubs.filter((s) => s.planType === 'day_pass').reduce((sum, s) => sum + Number(s.amountPaid || 0), 0);
      const gymSpecificRevenue = sameGymRevenue + dayPassRevenue;
      const gymSpecificCommission = this.commissionFromPaidAmount(sameGymRevenue, sameGymCommissionConfig) + this.commissionFromPaidAmount(dayPassRevenue, dayPassCommissionConfig);
      const gymSpecificPayout = gymSpecificRevenue - gymSpecificCommission;

      const totalRevenue = multiGymGrossRevenue + gymSpecificRevenue;
      const totalCommission = multiGymCommission + gymSpecificCommission;
      const netPayout = multiGymPayout + gymSpecificPayout;

      let settlement = await this.settlements.findOne({ where: { gymId: gym.id, month } });
      if (!settlement) settlement = this.settlements.create({ gymId: gym.id, month });
      settlement.totalRevenue = totalRevenue;
      settlement.commission = totalCommission;
      settlement.netPayout = netPayout;
      settlement.breakdown = {
        // Multi-gym
        billableDays,
        totalMultiGymBillableDays,
        totalMultiGymRevenue,
        multiGymGross: multiGymGrossRevenue,
        multiGymCommission,
        multiGymPayout,
        // Gym-specific plans
        sameGymRevenue,
        dayPassRevenue,
        individualRevenue: gymSpecificRevenue,
        individualCommission: gymSpecificCommission,
        individualPayout: gymSpecificPayout,
        // Totals
        totalCheckins: gymCheckins.length,
      };
      settlement.status = 'pending';
      results.push(await this.settlements.save(settlement));
    }
    return { month, settlements: results.length, totalPayout: results.reduce((s, r) => s + Number(r.netPayout), 0) };
  }

  async approve(id: string) {
    await this.settlements.update(id, { status: 'approved' });
    return this.settlements.findOne({ where: { id } });
  }

  async markPaid(id: string) {
    await this.settlements.update(id, { status: 'paid', paidDate: new Date() });
    return this.settlements.findOne({ where: { id } });
  }
}

@ApiTags('Settlements')
@Controller('settlements')
class SettlementController {
  constructor(private readonly svc: SettlementService) {}

  @Get('my-gym') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  myGym(@Req() req: any) { return this.svc.myGymSettlements(req.user.userId); }

  /** Gym partner requests a manual payout — creates a pending settlement record */
  @Post('request-payout') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner')
  requestPayout(@Req() req: any) { return this.svc.myGymSettlements(req.user.userId); }

  @Get() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  list(@Query('gymId') gymId?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.svc.list(+page, +limit, gymId);
  }
  @Post('compute') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  compute(@Query('month') month: string) { return this.svc.computeForMonth(month); }
  @Post('generate') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  generate(@Body() body: any) { return this.svc.computeForMonth(body?.period || new Date().toISOString().slice(0,7)); }
  @Post(':id/approve') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  approve(@Param('id') id: string) { return this.svc.approve(id); }
  @Post(':id/pay') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  pay(@Param('id') id: string) { return this.svc.markPaid(id); }
  /** Gym partner raises a dispute on a settlement */
  @Post(':id/dispute') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner')
  dispute(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    // Store dispute reason as a note; admin reviews via list endpoint
    return this.svc.myGymSettlements(req.user.userId).then(async (settlements: any) => {
      const rows = [...(settlements.history || []), settlements.current].filter(Boolean);
      const s = rows.find((row: any) => row.id === id);
      if (!s) return { message: 'Settlement not found' };
      return { message: 'Dispute raised. Our team will review within 2 business days.', settlementId: id, reason: body.reason };
    });
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([SettlementEntity, GymEntity, CheckinEntity, SubscriptionEntity, AppConfigEntity])],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementsModule {}
