import { Module, Controller, Get, Post, Put, Delete, Body, UseGuards, Req, Injectable, BadRequestException, NotFoundException, Param, Query } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate, paginatedResponse } from '../../common/pagination.helper';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { v4 as uuid } from 'uuid';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AppConfigEntity } from '../../database/entities/app-config.entity';
import { CouponEntity } from '../../database/entities/misc.entity';
import { GymEntity, GymPlanEntity, MultiGymNetworkEntity } from '../../database/entities/gym.entity';
import { TrainerEntity, TrainerBookingEntity } from '../../database/entities/trainer.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CashfreeService } from '../payments/cashfree.service';
import { PaymentsModule } from '../payments/payments.module';

/**
 * Default plan pricing. Admin can override multi_gym and day_pass via /subscriptions/multigym-config.
 * Same-gym plans are managed entirely by the gym owner in gym-plans module.
 */
const DEFAULT_MULTIGYM_CONFIG = {
  day_pass: {
    basePrice: 149,
    commission: { mode: 'percent', value: 0 },
  },
  same_gym: {
    commission: { mode: 'percent', value: 0 },
  },
  multi_gym: {
    name: 'Multi Gym Pass',
    subtitle: 'Unlimited access to every partner gym',
    basePrice: 1499,
    gymLimit: null,
    features: ['Unlimited gyms, unlimited visits', 'QR Check-in', 'Priority support', 'All gym tiers', 'PT session add-on eligible'],
  },
};

@Injectable()
class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionEntity) private readonly repo: Repository<SubscriptionEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AppConfigEntity) private readonly configRepo: Repository<AppConfigEntity>,
    @InjectRepository(CouponEntity) private readonly couponRepo: Repository<CouponEntity>,
    @InjectRepository(GymEntity) private readonly gymRepo: Repository<GymEntity>,
    @InjectRepository(GymPlanEntity) private readonly gymPlanRepo: Repository<GymPlanEntity>,
    @InjectRepository(MultiGymNetworkEntity) private readonly networkRepo: Repository<MultiGymNetworkEntity>,
    @InjectRepository(TrainerEntity) private readonly trainerRepo: Repository<TrainerEntity>,
    @InjectRepository(TrainerBookingEntity) private readonly trainerBookings: Repository<TrainerBookingEntity>,
    private readonly cashfree: CashfreeService,
  ) {}

  private normalizeCommissionConfig(value: any) {
    const mode = value?.mode === 'fixed' ? 'fixed' : 'percent';
    const rawValue = Number(value?.value);
    return { mode, value: Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0 };
  }

  private mergeConfig(value: any) {
    const merged: any = {
      day_pass: { ...DEFAULT_MULTIGYM_CONFIG.day_pass, ...(value?.day_pass || {}) },
      same_gym: { ...DEFAULT_MULTIGYM_CONFIG.same_gym, ...(value?.same_gym || {}) },
      multi_gym: { ...DEFAULT_MULTIGYM_CONFIG.multi_gym, ...(value?.multi_gym || {}) },
    };
    merged.day_pass.commission = this.normalizeCommissionConfig(merged.day_pass.commission);
    merged.same_gym.commission = this.normalizeCommissionConfig(merged.same_gym.commission);
    merged.day_pass.basePrice = Math.max(1, Math.round(Number(merged.day_pass.basePrice) || DEFAULT_MULTIGYM_CONFIG.day_pass.basePrice));
    merged.multi_gym.basePrice = Math.max(1, Math.round(Number(merged.multi_gym.basePrice) || DEFAULT_MULTIGYM_CONFIG.multi_gym.basePrice));
    return merged;
  }

  private commissionAmount(baseAmount: number, commission: { mode?: string; value?: number }) {
    const value = Math.max(0, Number(commission?.value) || 0);
    if (value <= 0) return 0;
    return commission?.mode === 'fixed' ? value : baseAmount * (value / 100);
  }

  private amountWithCheckoutCommission(baseAmount: number, planType: 'day_pass' | 'same_gym' | 'multi_gym', config: any) {
    if (planType !== 'day_pass' && planType !== 'same_gym') return Math.max(1, Math.round(baseAmount));
    const commission = planType === 'day_pass' ? config.day_pass?.commission : config.same_gym?.commission;
    return Math.max(1, Math.round(baseAmount + this.commissionAmount(baseAmount, commission)));
  }

  async getMultigymConfig() {
    const record = await this.configRepo.findOne({ where: { key: 'multigym_plans' } });
    return this.mergeConfig(record?.value);
  }

  async setMultigymConfig(data: Partial<typeof DEFAULT_MULTIGYM_CONFIG>) {
    const current = await this.getMultigymConfig();
    const merged = this.mergeConfig({
      day_pass: { ...(current as any).day_pass, ...((data as any)?.day_pass || {}) },
      same_gym: { ...(current as any).same_gym, ...((data as any)?.same_gym || {}) },
      multi_gym: { ...(current as any).multi_gym, ...((data as any)?.multi_gym || {}) },
    });
    await this.configRepo.save(this.configRepo.create({ key: 'multigym_plans', value: merged }));
    return merged;
  }

  async plans() {
    const config = await this.getMultigymConfig();
    return {
      day_pass: {
        planType: 'day_pass',
        name: '1-Day Pass',
        description: 'Drop in to any partner gym for a day',
        basePrice: config.day_pass?.basePrice || 149,
        commission: config.day_pass?.commission,
        features: ['Single visit', 'Any partner gym', 'Valid for 24 hours', 'No commitment'],
      },
      same_gym: {
        planType: 'same_gym',
        name: 'Same Gym Pass',
        description: 'Unlimited access to your chosen gym',
        basePrice: null,
        commission: config.same_gym?.commission,
        features: ['Unlimited visits', 'One gym of your choice', 'Monthly subscription', 'Slot booking'],
        note: 'Same-gym memberships are priced by each gym. Select a gym to see active plans.',
        requiresGymPlan: true,
      },
      multi_gym: { ...config.multi_gym, planType: 'multi_gym', name: 'Multi Gym Pass', basePrice: config.multi_gym?.basePrice || 1499 },
    };
  }

  private activeGymPass(userId: string, gymId?: string, excludeId?: string) {
    if (!gymId) return Promise.resolve(null);
    const qb = this.repo.createQueryBuilder('s')
      .select('s.id', 'id')
      .addSelect('s."endDate"', 'endDate')
      .addSelect('s."planType"', 'planType')
      .where('s."userId" = :userId', { userId })
      .andWhere('s.status = :status', { status: 'active' })
      .andWhere('s."planType" IN (:...planTypes)', { planTypes: ['same_gym', 'day_pass'] })
      .andWhere(':gymId = ANY(s."gymIds")', { gymId })
      .andWhere('s."endDate" >= CURRENT_DATE');

    if (excludeId) qb.andWhere('s.id != :excludeId', { excludeId });
    return qb.getRawOne();
  }

  private duplicateGymPassMessage(existing: any) {
    return `You already have an active pass for this gym${existing?.endDate ? ` until ${existing.endDate}` : ''}`;
  }

  private normalizeGymSummary(gym: any) {
    if (!gym) return null;
    const photos = Array.isArray(gym.photos) ? gym.photos.filter(Boolean) : [];
    const coverPhoto = gym.coverPhoto || photos[0] || null;
    return {
      ...gym,
      coverPhoto,
      coverImage: coverPhoto,
      photos,
      images: photos.length > 0 ? photos : (coverPhoto ? [coverPhoto] : []),
    };
  }

  private async assertNoActiveGymPass(userId: string, gymId?: string, excludeId?: string) {
    const existing = await this.activeGymPass(userId, gymId, excludeId);
    if (existing) throw new BadRequestException(this.duplicateGymPassMessage(existing));
  }

  private async discountForCoupon(code: string | undefined, amount: number) {
    const couponCode = code?.trim();
    if (!couponCode) return 0;

    const coupon = await this.couponRepo.findOne({ where: { code: couponCode, isActive: true } });
    if (!coupon) throw new BadRequestException('Invalid coupon');

    const now = new Date();
    if (now < new Date(coupon.validFrom) || now > new Date(coupon.validTo)) throw new BadRequestException('Coupon expired');
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) throw new BadRequestException('Coupon usage limit reached');
    if (amount < Number(coupon.minOrderValue || 0)) throw new BadRequestException(`Minimum order value is Rs ${coupon.minOrderValue}`);
    if (coupon.applicableTo?.length && !coupon.applicableTo.includes('subscription')) throw new BadRequestException('Coupon not applicable to subscriptions');

    let discount = coupon.discountType === 'percentage'
      ? amount * (Number(coupon.discountValue) / 100)
      : Number(coupon.discountValue);
    if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
    return Math.max(0, Math.min(amount, Math.round(discount)));
  }

  async myActive(userId: string) {
    const subs = await this.repo.createQueryBuilder('s')
      .select('s.id', 'id')
      .addSelect('s."userId"', 'userId')
      .addSelect('s."planType"', 'planType')
      .addSelect('s."durationMonths"', 'durationMonths')
      .addSelect('s."startDate"', 'startDate')
      .addSelect('s."endDate"', 'endDate')
      .addSelect('s.status', 'status')
      .addSelect('s."amountPaid"', 'amountPaid')
      .addSelect('s."gymIds"', 'gymIds')
      .addSelect('s."gymPlanId"', 'gymPlanId')
      .addSelect('s."razorpayOrderId"', 'razorpayOrderId')
      .addSelect('s."createdAt"', 'createdAt')
      .where('s."userId" = :userId', { userId })
      .orderBy('s."createdAt"', 'DESC')
      .limit(50)
      .getRawMany();
    // Enrich with gym name for same_gym and day_pass
    const allGymIds = [...new Set(subs.flatMap((s: any) => s.gymIds || []).filter(Boolean))];
    const gyms = allGymIds.length > 0
      ? await this.gymRepo.createQueryBuilder('g')
        .select('g.id', 'id')
        .addSelect('g.name', 'name')
        .addSelect('g."coverPhoto"', 'coverPhoto')
        .addSelect('g.photos', 'photos')
        .where('g.id IN (:...ids)', { ids: allGymIds })
        .getRawMany()
      : [];
    const gymMap: Record<string, any> = Object.fromEntries(gyms.map((g: any) => [g.id, this.normalizeGymSummary(g)]));
    const gymPlanIds = [...new Set(subs.map((s: any) => s.gymPlanId).filter(Boolean))];
    const gymPlans = gymPlanIds.length > 0
      ? await this.gymPlanRepo.createQueryBuilder('gp')
        .select('gp.id', 'id')
        .addSelect('gp.name', 'name')
        .addSelect('gp.price', 'price')
        .addSelect('gp."durationDays"', 'durationDays')
        .where('gp.id IN (:...ids)', { ids: gymPlanIds })
        .getRawMany()
      : [];
    const gymPlanMap: Record<string, any> = Object.fromEntries(gymPlans.map((plan: any) => [plan.id, plan]));
    const PLAN_LABELS: Record<string, string> = { day_pass: '1-Day Pass', same_gym: 'Same Gym Pass', multi_gym: 'Multi Gym Pass' };
    return subs.map((sub: any) => {
      const primaryGymId = sub.gymIds?.[0] || null;
      const gym = primaryGymId ? (gymMap[primaryGymId] || null) : null;
      const gymPlan = sub.gymPlanId ? (gymPlanMap[sub.gymPlanId] || null) : null;
      const gymName = gym?.name || null;
      return {
        ...sub,
        primaryGymId,
        gymId: primaryGymId,
        gymName,
        gym: primaryGymId ? { id: primaryGymId, name: gymName, coverPhoto: gym?.coverPhoto || null, coverImage: gym?.coverImage || null, photos: gym?.photos || [], images: gym?.images || [] } : null,
        plan: gymPlan ? { id: gymPlan.id, name: gymPlan.name, price: gymPlan.price, durationDays: gymPlan.durationDays } : null,
        planLabel: gymPlan?.name || PLAN_LABELS[sub.planType] || sub.planType,
      };
    });
  }

  /**
   * Creates a subscription + Cashfree payment order.
   * - day_pass: no gym required, durationMonths=0.
   * - same_gym: requires gymId.
   * - multi_gym: no gym selection required.
   */
  async purchase(userId: string, phone: string, email: string | undefined, dto: {
    planType: 'day_pass' | 'same_gym' | 'multi_gym';
    durationMonths: number;
    gymId?: string;
    gymPlanId?: string;
    amountOverride?: number;
    isDayPass?: boolean;
    ptAddon?: boolean;
    ptDurationMonths?: number;
    ptTrainerId?: string;
    couponCode?: string;
  }) {
    const config = await this.getMultigymConfig();
    let amount: number;
    let gymIds: string[] = [];
    let gymPlanId: string | undefined;
    let durationMonths = dto.planType === 'day_pass' ? 0 : (dto.durationMonths || 1);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (dto.planType === 'same_gym') {
      if (!dto.gymId) throw new BadRequestException('gymId required for Same Gym Pass');
      if (!uuidRe.test(dto.gymId)) throw new BadRequestException('Invalid gymId format');
      gymIds = [dto.gymId];
      gymPlanId = dto.gymPlanId;
      const gym = await this.gymRepo.createQueryBuilder('g')
        .select('g.id', 'id')
        .addSelect('g.name', 'name')
        .where('g.id = :id', { id: dto.gymId })
        .getRawOne();
      if (!gym) throw new BadRequestException('Gym not found');
      await this.assertNoActiveGymPass(userId, dto.gymId);

      if (!gymPlanId) {
        throw new BadRequestException('Select an active gym subscription plan before checkout');
      }

      const gymPlan = await this.gymPlanRepo.findOne({ where: { id: gymPlanId, gymId: dto.gymId, isActive: true } });
      if (!gymPlan) throw new BadRequestException('Gym plan not found');

      amount = this.amountWithCheckoutCommission(Number(gymPlan.price), 'same_gym', config);
      durationMonths = Math.max(1, Math.round((gymPlan.durationDays || 30) / 30));
    } else if (dto.planType === 'multi_gym') {
      const price = config.multi_gym?.basePrice || 1499;
      amount = price * (durationMonths || 1);
    } else if (dto.planType === 'day_pass') {
      if (dto.gymId && uuidRe.test(dto.gymId)) gymIds = [dto.gymId];
      if (dto.gymId && uuidRe.test(dto.gymId)) {
        const gym = await this.gymRepo.createQueryBuilder('g')
          .select('g.id', 'id')
          .addSelect('g."dayPassPrice"', 'dayPassPrice')
          .where('g.id = :id', { id: dto.gymId })
          .getRawOne();
        if (!gym) throw new BadRequestException('Gym not found');
        await this.assertNoActiveGymPass(userId, dto.gymId);
        amount = this.amountWithCheckoutCommission(Number(gym.dayPassPrice || config.day_pass?.basePrice || 149), 'day_pass', config);
      } else {
        amount = this.amountWithCheckoutCommission(Number(config.day_pass?.basePrice || 149), 'day_pass', config);
      }
    } else {
      throw new BadRequestException('Invalid planType. Use day_pass, same_gym, or multi_gym');
    }

    let ptBooking: TrainerBookingEntity | null = null;
    if (dto.ptAddon && dto.planType !== 'day_pass') {
      const ptMonths = Math.max(1, Math.min(durationMonths || 1, Math.round(Number(dto.ptDurationMonths) || durationMonths || 1)));
      if (!dto.ptTrainerId) throw new BadRequestException('Select a trainer for the personal trainer add-on');
      const trainer = await this.trainerRepo.findOne({ where: { id: dto.ptTrainerId, isActive: true } });
      if (!trainer) throw new BadRequestException('Selected trainer is not available');
      if (dto.planType === 'same_gym' && gymIds[0] && trainer.gymId !== gymIds[0]) {
        throw new BadRequestException('Selected trainer does not belong to this gym');
      }
      const ptMonthlyPrice = Number(trainer.monthlyPrice || trainer.pricePerSession || 0);
      if (!Number.isFinite(ptMonthlyPrice) || ptMonthlyPrice <= 0) throw new BadRequestException('Selected trainer monthly price is not configured');
      const ptAmount = Math.round(ptMonthlyPrice * ptMonths);
      amount += ptAmount;
      const ptCommission = ptAmount * 0.25;
      ptBooking = this.trainerBookings.create({
        userId,
        trainerId: trainer.id,
        gymId: trainer.gymId,
        sessionDate: new Date(),
        durationMonths: ptMonths,
        sessions: 0,
        amount: ptAmount,
        platformCommission: ptCommission,
        status: 'pending',
      });
    }

    const couponDiscount = await this.discountForCoupon(dto.couponCode, amount);
    amount = Math.max(0, amount - couponDiscount);
    amount = Math.max(1, Math.round(amount));

    const startDate = new Date();
    const endDate = new Date();
    if (dto.planType === 'day_pass') {
      endDate.setDate(endDate.getDate() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + durationMonths);
    }
    const cfOrderId = `SUB_${uuid().slice(0, 18)}`;

    const user = await this.userRepo.findOne({ where: { id: userId } });

    const entity = this.repo.create({
      userId,
      planType: dto.planType,
      durationMonths,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      status: 'pending', // becomes 'active' after payment webhook or verify
      amountPaid: amount,
      gymIds,
      gymPlanId,
      razorpayOrderId: cfOrderId,
    } as any);
    const sub = (await this.repo.save(entity as any)) as SubscriptionEntity;
    if (ptBooking) {
      ptBooking.cashfreeOrderId = cfOrderId;
      await this.trainerBookings.save(ptBooking);
    }

    const payment = await this.cashfree.createOrder({
      orderId: cfOrderId,
      amount,
      customerId: userId,
      customerPhone: phone || user?.phone || '0000000000',
      customerEmail: email || user?.email,
      notes: {
        kind: 'subscription',
        subscriptionId: sub.id,
        planType: dto.planType,
        ptAddon: String(!!dto.ptAddon),
        ptDurationMonths: String(dto.ptDurationMonths || 0),
        ptTrainerId: dto.ptTrainerId || '',
      },
    });

    // In dev/mock mode, auto-activate immediately
    if ((payment as any)?.mock) {
      if ((sub.planType === 'same_gym' || sub.planType === 'day_pass') && sub.gymIds?.[0]) {
        await this.assertNoActiveGymPass(userId, sub.gymIds[0], sub.id);
      }
      await this.repo.update(sub.id, { status: 'active' });
      if (ptBooking) await this.trainerBookings.update(ptBooking.id, { status: 'confirmed' });
      sub.status = 'active';
    }

    return { subscription: sub, payment };
  }

  /** Verify/activate a subscription after payment (called by mobile on success) */
  async verifyAndActivate(subId: string, userId: string) {
    const sub = await this.repo.findOne({ where: { id: subId, userId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status === 'active') {
      if (sub.razorpayOrderId) await this.trainerBookings.update({ cashfreeOrderId: sub.razorpayOrderId }, { status: 'confirmed' });
      return { success: true, subscription: sub };
    }

    if ((sub.planType === 'same_gym' || sub.planType === 'day_pass') && sub.gymIds?.[0]) {
      await this.assertNoActiveGymPass(userId, sub.gymIds[0], sub.id);
    }

    // Only explicit mock orders activate without asking Cashfree.
    if ((process.env.CASHFREE_MOCK_MODE === 'true' && process.env.NODE_ENV !== 'production') || !sub.razorpayOrderId) {
      await this.repo.update(subId, { status: 'active' });
      if (sub.razorpayOrderId) await this.trainerBookings.update({ cashfreeOrderId: sub.razorpayOrderId }, { status: 'confirmed' });
      sub.status = 'active';
      return { success: true, subscription: sub };
    }

    // Prod: fetch Cashfree order status
    const payment = await this.cashfree.fetchPaidStatus(sub.razorpayOrderId);
    if (payment.paid) {
      await this.repo.update(subId, { status: 'active' });
      await this.trainerBookings.update({ cashfreeOrderId: sub.razorpayOrderId }, { status: 'confirmed' });
      sub.status = 'active';
    }
    return { success: sub.status === 'active', subscription: sub, paymentStatus: payment.paid ? 'PAID' : payment.orderStatus || 'unknown' };
  }

  async list(page: any = 1, limit: any = 20, status?: string, gymId?: string) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const qb = this.repo.createQueryBuilder('s')
      .select('s.id', 'id')
      .addSelect('s."userId"', 'userId')
      .addSelect('s."planType"', 'planType')
      .addSelect('s."durationMonths"', 'durationMonths')
      .addSelect('s."startDate"', 'startDate')
      .addSelect('s."endDate"', 'endDate')
      .addSelect('s.status', 'status')
      .addSelect('s."amountPaid"', 'amountPaid')
      .addSelect('s."gymIds"', 'gymIds')
      .addSelect('s."createdAt"', 'createdAt')
      .orderBy('s."createdAt"', 'DESC')
      .skip(skip)
      .take(take);
    if (status) qb.andWhere('s.status = :status', { status });
    if (gymId) qb.andWhere(':gymId = ANY(s."gymIds")', { gymId });
    const [data, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);
    return paginatedResponse(data, total, p, l);
  }

  async freeze(subscriptionId: string, userId: string) {
    const sub = await this.repo.findOne({ where: { id: subscriptionId, userId } });
    if (!sub) throw new BadRequestException('Subscription not found');
    if (sub.status !== 'active') throw new BadRequestException('Only active subscriptions can be frozen');
    await this.repo.update(subscriptionId, { status: 'frozen' });
    return { success: true, message: 'Subscription frozen. Days will be added when you unfreeze.' };
  }

  async unfreeze(subscriptionId: string, userId: string) {
    const sub = await this.repo.findOne({ where: { id: subscriptionId, userId } });
    if (!sub) throw new BadRequestException('Subscription not found');
    if (sub.status !== 'frozen') throw new BadRequestException('Subscription is not frozen');
    if ((sub.planType === 'same_gym' || sub.planType === 'day_pass') && sub.gymIds?.[0]) {
      await this.assertNoActiveGymPass(userId, sub.gymIds[0], sub.id);
    }
    const newEnd = new Date(sub.endDate);
    newEnd.setDate(newEnd.getDate() + 30);
    await this.repo.update(subscriptionId, {
      status: 'active',
      endDate: newEnd.toISOString().slice(0, 10),
    });
    return { success: true, message: 'Subscription reactivated. End date extended by 30 days.' };
  }

  async listMultiGymNetwork() {
    const entries = await this.networkRepo.find({ where: { isActive: true } });
    const gymIds = entries.map(e => e.gymId);
    if (gymIds.length === 0) return [];
    const gyms = await this.gymRepo.findByIds(gymIds);
    return gyms.map((gym) => this.normalizeGymSummary(gym));
  }

  async addToNetwork(gymId: string) {
    const existing = await this.networkRepo.findOne({ where: { gymId } });
    if (existing) { existing.isActive = true; return this.networkRepo.save(existing); }
    return this.networkRepo.save(this.networkRepo.create({ gymId, isActive: true }));
  }

  async removeFromNetwork(gymId: string) {
    await this.networkRepo.update({ gymId }, { isActive: false });
    return { success: true };
  }

  async generateInvoice(id: string, userId: string) {
    const sub = await this.repo.findOne({ where: { id, userId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (!sub.invoiceNumber) {
      const d = new Date();
      const seq = Math.floor(10000 + Math.random() * 90000);
      sub.invoiceNumber = `BMF-INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${seq}`;
      await this.repo.save(sub);
    }
    const user = await this.userRepo.findOne({ where: { id: sub.userId } });
    const amount = Number(sub.amountPaid) || 0;
    const gstRate = 0.18;
    const baseAmount = Math.round(amount / (1 + gstRate));
    const gstAmount = amount - baseAmount;
    const cgst = Math.round(gstAmount / 2);
    const sgst = Math.round(gstAmount / 2);
    const planLabels: Record<string, string> = {
      day_pass: '1-Day Pass',
      same_gym: 'Same Gym Pass',
      multi_gym: 'Multi Gym Pass',
    };
    const planName = planLabels[sub.planType] || sub.planType || 'Standard';
    return {
      invoiceNumber: sub.invoiceNumber,
      invoiceDate: sub.createdAt,
      customer: { name: user?.name, phone: user?.phone, email: user?.email },
      items: [{ description: `BookMyFit Subscription - ${planName}`, months: sub.durationMonths || 1, amount: baseAmount }],
      subtotal: baseAmount,
      cgst,
      sgst,
      totalGst: cgst + sgst,
      total: amount,
      gstin: 'PENDING_REGISTRATION',
      companyName: 'BookMyFit Technologies Pvt Ltd',
      companyAddress: 'Mumbai, Maharashtra, India',
      pan: 'PENDING',
    };
  }

  async adminInvoices() {
    const subs = await this.repo.find({ order: { createdAt: 'DESC' }, take: 200 });
    return subs.map(sub => ({
      id: sub.id,
      userId: sub.userId,
      planType: sub.planType,
      amountPaid: sub.amountPaid,
      invoiceNumber: sub.invoiceNumber || null,
      status: sub.status,
      createdAt: sub.createdAt,
    }));
  }
}

@ApiTags('Subscriptions')
@Controller('subscriptions')
class SubscriptionsController {
  constructor(private readonly svc: SubscriptionsService) {}

  /** Public: returns multigym plan structure (Pro & Max). Individual plans are per-gym. */
  @Get('plans') plans() { return this.svc.plans(); }

  /** Admin: get multigym config */
  @Get('multigym-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  getConfig() { return this.svc.getMultigymConfig(); }

  /** Admin: update multigym pricing */
  @Put('multigym-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  setConfig(@Body() body: any) { return this.svc.setMultigymConfig(body); }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  mine(@Req() req: any) { return this.svc.myActive(req.user.userId); }

  @Post('purchase')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  purchase(@Req() req: any, @Body() body: any) {
    return this.svc.purchase(req.user.userId, req.user.phone, req.user.email, body);
  }

  @Post(':id/verify')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  verify(@Param('id') id: string, @Req() req: any) { return this.svc.verifyAndActivate(id, req.user.userId); }

  @Get('all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  all(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('gymId') gymId?: string,
  ) { return this.svc.list(+page, +limit, status, gymId); }

  @Post(':id/freeze')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  freeze(@Param('id') id: string, @Req() req: any) { return this.svc.freeze(id, req.user.userId); }

  @Post(':id/unfreeze')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  unfreeze(@Param('id') id: string, @Req() req: any) { return this.svc.unfreeze(id, req.user.userId); }

  @Post(':id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'end_user')
  async cancel(@Param('id') id: string, @Req() req: any) {
    // Allow owner to cancel their own, or super_admin to cancel any
    return this.svc.freeze(id, req.user.userId).then(() => ({ success: true, subscriptionId: id, status: 'cancelled' }));
  }

  @Get('admin/invoices')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  adminInvoices() { return this.svc.adminInvoices(); }

  @Get('multigym-network')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  listNetwork() { return this.svc.listMultiGymNetwork(); }

  @Post('multigym-network')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  addToNetwork(@Body() body: { gymId: string }) { return this.svc.addToNetwork(body.gymId); }

  @Delete('multigym-network/:gymId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  removeFromNetwork(@Param('gymId') gymId: string) { return this.svc.removeFromNetwork(gymId); }

  @Get(':id/invoice')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  invoice(@Param('id') id: string, @Req() req: any) { return this.svc.generateInvoice(id, req.user.userId); }
}

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionEntity, UserEntity, AppConfigEntity, CouponEntity, GymEntity, GymPlanEntity, MultiGymNetworkEntity, TrainerEntity, TrainerBookingEntity]), PaymentsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
