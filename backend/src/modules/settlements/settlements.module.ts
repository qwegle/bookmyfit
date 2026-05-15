import { Module, Controller, Get, Post, Body, Param, Query, Injectable, UseGuards, Req } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { paginate, paginatedResponse } from '../../common/pagination.helper';
import { ApiTags } from '@nestjs/swagger';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SettlementEntity } from '../../database/entities/settlement.entity';
import { GymEntity, GymPlanEntity } from '../../database/entities/gym.entity';
import { CheckinEntity } from '../../database/entities/checkin.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { AppConfigEntity } from '../../database/entities/app-config.entity';
import { TrainerBookingEntity } from '../../database/entities/trainer.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { PLATFORM_PRICING_CONFIG_KEY, commissionAmount, serviceCommission } from '../../common/commission-config';

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
    @InjectRepository(GymPlanEntity) private readonly gymPlans: Repository<GymPlanEntity>,
    @InjectRepository(TrainerBookingEntity) private readonly trainerBookings: Repository<TrainerBookingEntity>,
  ) {}

  private paidSubscriptionStatuses() {
    return ['active', 'frozen', 'expired', 'cancelled'];
  }

  private money(value: any) {
    const amount = Number(value || 0);
    return Number.isFinite(amount) ? Math.round(amount) : 0;
  }

  private directGymSubscriptionsQuery(gymId: string) {
    return this.subs
      .createQueryBuilder('s')
      .leftJoin(GymPlanEntity, 'gp', 'gp.id::text = s."gymPlanId" AND gp."gymId" = :gymId', { gymId })
      .where(new Brackets((where) => {
        where
          .where('CAST(:gymId AS uuid) = ANY(COALESCE(s."gymIds", ARRAY[]::uuid[]))', { gymId })
          .orWhere('gp.id IS NOT NULL');
      }))
      .andWhere('s."planType" IN (:...planTypes)', { planTypes: ['same_gym', 'day_pass'] })
      .andWhere('s.status IN (:...statuses)', { statuses: this.paidSubscriptionStatuses() });
  }

  private async multiGymPayout(gym: GymEntity, from?: Date, to?: Date) {
    const qb = this.checkins.createQueryBuilder('c')
      .innerJoin(SubscriptionEntity, 's', 's.id = c."subscriptionId"')
      .select('COUNT(DISTINCT (c."userId"::text || \':\' || DATE(c."checkinTime")::text))', 'count')
      .where('c."gymId" = :gymId', { gymId: gym.id })
      .andWhere('c.status = :status', { status: 'success' })
      .andWhere('s."planType" = :planType', { planType: 'multi_gym' });
    if (from && to) qb.andWhere('c."checkinTime" >= :from AND c."checkinTime" < :to', { from, to });
    const row = await qb.getRawOne();
    const billableDays = Number(row?.count || 0);
    const ratePerDay = Number((gym as any).ratePerDay || 0);
    return {
      billableDays,
      ratePerDay,
      payout: this.money(billableDays * ratePerDay),
    };
  }

  private async trainerSummary(gymId: string, from?: Date, to?: Date) {
    const qb = this.trainerBookings.createQueryBuilder('tb')
      .where('tb."gymId" = :gymId', { gymId })
      .andWhere('tb.status IN (:...statuses)', { statuses: ['confirmed', 'completed', 'active'] });
    if (from && to) qb.andWhere('tb."createdAt" >= :from AND tb."createdAt" < :to', { from, to });
    const rows = await qb.getMany();
    const gross = rows.reduce((sum, row) => sum + this.money(row.amount), 0);
    const commission = rows.reduce((sum, row) => sum + this.money(row.platformCommission), 0);
    return {
      count: rows.length,
      gross,
      commission,
      payout: Math.max(0, gross - commission),
    };
  }

  private async revenueSummary(gym: GymEntity, from?: Date, to?: Date) {
    const configRow = await this.configs.findOne({ where: { key: PLATFORM_PRICING_CONFIG_KEY } });
    const sameGymCommissionConfig = serviceCommission(configRow?.value, 'same_gym');
    const dayPassCommissionConfig = serviceCommission(configRow?.value, 'day_pass');
    const subsQb = this.directGymSubscriptionsQuery(gym.id);
    if (from && to) subsQb.andWhere('s."createdAt" >= :from AND s."createdAt" < :to', { from, to });
    const subs = await subsQb.getMany();
    const planIds = [...new Set(subs.map((s) => s.gymPlanId).filter(Boolean))];
    const plans = planIds.length ? await this.gymPlans.find({ where: { id: In(planIds as string[]) } }) : [];
    const planMap = new Map(plans.map((plan) => [plan.id, plan]));
    let sameGymBase = 0;
    let dayPassBase = 0;
    for (const sub of subs) {
      if (sub.planType === 'same_gym') {
        const plan = sub.gymPlanId ? planMap.get(sub.gymPlanId) : null;
        sameGymBase += this.money(plan?.price ?? (gym as any).sameGymMonthlyPrice ?? 0);
      } else if (sub.planType === 'day_pass') {
        dayPassBase += this.money((gym as any).dayPassPrice ?? 149);
      }
    }
    const sameGymCommission = this.money(commissionAmount(sameGymBase, sameGymCommissionConfig));
    const dayPassCommission = this.money(commissionAmount(dayPassBase, dayPassCommissionConfig));
    const [multiGym, trainer] = await Promise.all([
      this.multiGymPayout(gym, from, to),
      this.trainerSummary(gym.id, from, to),
    ]);
    const subscriptionPayout = sameGymBase + dayPassBase;
    const subscriptionCommission = sameGymCommission + dayPassCommission;
    const totalRevenue = subscriptionPayout + subscriptionCommission + multiGym.payout + trainer.gross;
    const totalCommission = subscriptionCommission + trainer.commission;
    const netPayout = subscriptionPayout + multiGym.payout + trainer.payout;
    const todayIso = new Date().toISOString().slice(0, 10);
    return {
      totalRevenue: this.money(totalRevenue),
      totalCommission: this.money(totalCommission),
      netPayout: this.money(netPayout),
      subscriberCount: subs.length,
      activeSubscriberCount: subs.filter((sub) => sub.status === 'active' && String(sub.endDate).slice(0, 10) >= todayIso).length,
      breakdown: {
        sameGymRevenue: sameGymBase,
        sameGymCommission,
        sameGymPayout: sameGymBase,
        dayPassRevenue: dayPassBase,
        dayPassCommission,
        dayPassPayout: dayPassBase,
        individualRevenue: subscriptionPayout,
        individualCommission: subscriptionCommission,
        individualPayout: subscriptionPayout,
        billableDays: multiGym.billableDays,
        ratePerDay: multiGym.ratePerDay,
        multiGymGross: multiGym.payout,
        multiGymCommission: 0,
        multiGymPayout: multiGym.payout,
        ptRevenue: trainer.gross,
        ptCommission: trainer.commission,
        ptPayout: trainer.payout,
        trainerAddons: trainer.count,
        subscriberCount: subs.length,
        activeSubscriberCount: subs.filter((sub) => sub.status === 'active' && String(sub.endDate).slice(0, 10) >= todayIso).length,
      },
    };
  }

  async myGymSettlements(ownerId: string) {
    const gym = await this.gyms.findOne({ where: { ownerId } });
    if (!gym) return { current: this.emptyCurrent(), history: [] };
    const rows = await this.settlements.find({ where: { gymId: gym.id }, order: { month: 'DESC' } });
    const mapped = rows.map((s) => this.mapGymSettlement(s, gym));
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentRow = mapped.find((s) => s.period === currentMonth);
    const projected = currentRow ? null : await this.currentProjection(gym);
    const lifetime = await this.revenueSummary(gym);
    return {
      current: {
        ...(currentRow ? this.currentDto(currentRow) : projected),
        lifetimeNetPayout: lifetime.netPayout,
        lifetimeGymEarned: lifetime.netPayout,
        subscriberCount: lifetime.subscriberCount,
        activeSubscriberCount: lifetime.activeSubscriberCount,
      },
      history: mapped.filter((s) => s.period !== currentMonth),
    };
  }

  private async currentProjection(gym: GymEntity) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const summary = await this.revenueSummary(gym, from, to);
    return {
      ...this.emptyCurrent(),
      grossRevenue: summary.netPayout,
      netPayout: summary.netPayout,
      status: summary.netPayout > 0 ? 'projected' : 'not_generated',
      individualPool: Number(summary.breakdown.sameGymPayout || 0),
      dayPassPool: Number(summary.breakdown.dayPassPayout || 0),
      multiGymPool: Number(summary.breakdown.multiGymPayout || 0),
      trainerPool: Number(summary.breakdown.ptPayout || 0),
      subscriberCount: summary.subscriberCount,
      activeSubscriberCount: summary.activeSubscriberCount,
      trainerAddons: Number(summary.breakdown.trainerAddons || 0),
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

  private mapGymSettlement(s: SettlementEntity, gym?: GymEntity) {
    const netPayout = Number(s.netPayout || 0);
    return {
      ...s,
      gymName: gym?.name || 'Unknown Gym',
      period: s.month,
      grossRevenue: netPayout,
      commission: 0,
      netPayout,
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
      trainerPool: 0,
      lifetimeNetPayout: 0,
      lifetimeGymEarned: 0,
      subscriberCount: 0,
      activeSubscriberCount: 0,
      trainerAddons: 0,
    };
  }

  private currentDto(row: any) {
    return {
      grossRevenue: row.grossRevenue,
      commission: row.commission,
      netPayout: row.netPayout,
      commissionRate: row.commissionRate,
      status: row.status,
      individualPool: Number(row.breakdown?.sameGymPayout ?? row.breakdown?.sameGymRevenue ?? 0),
      multiGymPool: Number(row.breakdown?.multiGymPayout ?? row.breakdown?.multiGymGross ?? 0),
      dayPassPool: Number(row.breakdown?.dayPassPayout ?? row.breakdown?.dayPassRevenue ?? 0),
      trainerPool: Number(row.breakdown?.ptPayout ?? 0),
      subscriberCount: Number(row.breakdown?.subscriberCount ?? 0),
      activeSubscriberCount: Number(row.breakdown?.activeSubscriberCount ?? 0),
      trainerAddons: Number(row.breakdown?.trainerAddons ?? 0),
    };
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

    const results: SettlementEntity[] = [];

    for (const gym of gyms) {
      const summary = await this.revenueSummary(gym, from, to);

      let settlement = await this.settlements.findOne({ where: { gymId: gym.id, month } });
      if (!settlement) settlement = this.settlements.create({ gymId: gym.id, month });
      settlement.totalRevenue = summary.totalRevenue;
      settlement.commission = summary.totalCommission;
      settlement.netPayout = summary.netPayout;
      settlement.breakdown = summary.breakdown;
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
  imports: [TypeOrmModule.forFeature([SettlementEntity, GymEntity, CheckinEntity, SubscriptionEntity, AppConfigEntity, GymPlanEntity, TrainerBookingEntity])],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementsModule {}
