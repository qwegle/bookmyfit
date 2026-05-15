import { Module, Controller, Get, Post, Put, Param, Body, Query, Injectable, UseGuards, Req, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate, paginatedResponse } from '../../common/pagination.helper';
import { ApiTags } from '@nestjs/swagger';
import { TrainerEntity, TrainerBookingEntity } from '../../database/entities/trainer.entity';
import { GymEntity } from '../../database/entities/gym.entity';
import { AppConfigEntity } from '../../database/entities/app-config.entity';
import { CashfreeService } from '../payments/cashfree.service';
import { PaymentsModule } from '../payments/payments.module';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { PLATFORM_PRICING_CONFIG_KEY, applyCheckoutCommission, commissionAmount, serviceCommission } from '../../common/commission-config';

@Injectable()
class TrainersService {
  constructor(
    @InjectRepository(TrainerEntity) private readonly repo: Repository<TrainerEntity>,
    @InjectRepository(TrainerBookingEntity) private readonly bookings: Repository<TrainerBookingEntity>,
    @InjectRepository(GymEntity) private readonly gyms: Repository<GymEntity>,
    @InjectRepository(AppConfigEntity) private readonly configRepo: Repository<AppConfigEntity>,
    private readonly cashfree: CashfreeService,
  ) {}
  private trainerDto(t: TrainerEntity) {
    return {
      ...t,
      _id: t.id,
      specialty: t.specialization,
      monthlyPriceInr: Number(t.monthlyPrice || 0),
      sessionRateInr: Number(t.monthlyPrice || t.pricePerSession || 0),
      status: t.isActive ? 'active' : 'inactive',
    };
  }

  async listByGym(gymId: string, page: any = 1, limit: any = 20) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const [data, total] = await this.repo.findAndCount({ where: { gymId, isActive: true }, skip, take });
    return paginatedResponse(data.map((t) => this.trainerDto(t)), total, p, l);
  }
  async get(id: string) {
    const trainer = await this.repo.findOne({ where: { id } });
    return trainer ? this.trainerDto(trainer) : null;
  }

  private async resolveGymForWrite(user: any, requestedGymId?: string) {
    if (user?.role === 'super_admin') {
      if (!requestedGymId) throw new BadRequestException('gymId is required');
      const gym = await this.gyms.findOne({ where: { id: requestedGymId } });
      if (!gym) throw new NotFoundException('Gym not found');
      return gym;
    }
    const gym = await this.gyms.findOne({ where: { ownerId: user?.userId } });
    if (!gym) throw new NotFoundException('Gym not found');
    if (requestedGymId && requestedGymId !== gym.id) throw new ForbiddenException('Cannot manage trainers for another gym');
    return gym;
  }

  private sanitize(data: any) {
    const monthlyPrice = Number(data.monthlyPrice ?? data.monthlyPriceInr ?? data.sessionRateInr ?? data.pricePerSession ?? 0);
    if (!data.name?.trim()) throw new BadRequestException('Trainer name is required');
    if (!String(data.specialization ?? data.specialty ?? '').trim()) throw new BadRequestException('Specialization is required');
    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) throw new BadRequestException('Monthly price must be valid');
    return {
      name: data.name.trim(),
      specialization: String(data.specialization ?? data.specialty).trim(),
      monthlyPrice,
      pricePerSession: monthlyPrice,
      photoUrl: data.photoUrl,
      bio: data.bio,
      isActive: data.isActive ?? data.status !== 'inactive',
    };
  }

  async create(user: any, data: Partial<TrainerEntity>) {
    const gym = await this.resolveGymForWrite(user, (data as any).gymId);
    const trainer = await this.repo.save(this.repo.create({ ...this.sanitize(data), gymId: gym.id }));
    return this.trainerDto(trainer);
  }

  async update(id: string, user: any, data: Partial<TrainerEntity>) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Trainer not found');
    const gym = await this.resolveGymForWrite(user, existing.gymId);
    if (gym.id !== existing.gymId) throw new ForbiddenException('Cannot manage trainers for another gym');
    const patch = ('name' in data || 'specialization' in data || 'specialty' in data || 'monthlyPrice' in data || 'monthlyPriceInr' in data || 'sessionRateInr' in data || 'pricePerSession' in data)
      ? this.sanitize({ ...existing, ...data })
      : data;
    if ((data as any).status === 'inactive') (patch as any).isActive = false;
    await this.repo.update(id, patch as any);
    return this.get(id);
  }

  async book(userId: string, trainerId: string, durationMonths: number, startDate: string, customerPhone: string) {
    const trainer = await this.repo.findOne({ where: { id: trainerId, isActive: true } });
    if (!trainer) throw new Error('Trainer not found');
    const months = Math.max(1, Math.min(12, Number(durationMonths) || 1));
    const baseAmount = Number(trainer.monthlyPrice || trainer.pricePerSession || 0) * months;
    if (baseAmount <= 0) throw new BadRequestException('Trainer monthly price is not configured');
    const configRow = await this.configRepo.findOne({ where: { key: PLATFORM_PRICING_CONFIG_KEY } });
    const commission = serviceCommission(configRow?.value, 'personal_training');
    const amount = applyCheckoutCommission(baseAmount, commission);
    const platformCommission = commissionAmount(baseAmount, commission);
    const orderId = `PT_${uuid().slice(0, 18)}`;

    const booking = await this.bookings.save(this.bookings.create({
      userId, trainerId, gymId: trainer.gymId,
      sessionDate: new Date(startDate || Date.now()), durationMonths: months, sessions: 0, amount, platformCommission,
      status: 'pending', cashfreeOrderId: orderId,
    }));

    const payment = await this.cashfree.createOrder({
      orderId, amount, customerId: userId, customerPhone,
      notes: { kind: 'pt_booking', bookingId: booking.id },
    });

    return { booking, payment };
  }
}

@ApiTags('Trainers (PT)')
@Controller('trainers')
@UseGuards(JwtAuthGuard, RolesGuard)
class TrainersController {
  constructor(private readonly svc: TrainersService) {}
  @Get() @Roles('end_user', 'gym_owner', 'gym_staff', 'super_admin', 'corporate_admin')
  list(@Query('gymId') gymId: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.svc.listByGym(gymId, +page, +limit);
  }
  @Get(':id') @Roles('end_user', 'gym_owner', 'gym_staff', 'super_admin')
  get(@Param('id') id: string) { return this.svc.get(id); }
  @Post() @Roles('gym_owner', 'super_admin')
  create(@Req() req: any, @Body() body: any) { return this.svc.create(req.user, body); }
  @Put(':id') @Roles('gym_owner', 'super_admin')
  update(@Param('id') id: string, @Req() req: any, @Body() body: any) { return this.svc.update(id, req.user, body); }
  @Post(':id/book') @Roles('end_user', 'corporate_admin')
  book(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const userId = body.userId || req.user?.userId;
    return this.svc.book(userId, id, body.durationMonths || body.months || 1, body.startDate || body.sessionDate, body.phone);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([TrainerEntity, TrainerBookingEntity, GymEntity, AppConfigEntity]), PaymentsModule],
  controllers: [TrainersController],
  providers: [TrainersService],
})
export class TrainersModule {}
