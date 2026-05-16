import { Module, Controller, Get, Post, Put, Patch, Param, Body, Query, Injectable, UseGuards, Req, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Brackets, In } from 'typeorm';
import { paginate, paginatedResponse } from '../../common/pagination.helper';
import { ApiTags } from '@nestjs/swagger';
import { GymEntity, GymPlanEntity, GymStatus } from '../../database/entities/gym.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { CheckinEntity } from '../../database/entities/checkin.entity';
import { AmenityEntity, CategoryEntity } from '../../database/entities/misc.entity';
import { GymScheduleEntity } from '../../database/entities/gym-schedule.entity';
import { TrainerBookingEntity, TrainerEntity } from '../../database/entities/trainer.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';

function normalizeCatalogName(value: any): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

@Injectable()
class GymsService {
  constructor(
    @InjectRepository(GymEntity) private readonly repo: Repository<GymEntity>,
    @InjectRepository(SubscriptionEntity) private readonly subs: Repository<SubscriptionEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(CheckinEntity) private readonly checkins: Repository<CheckinEntity>,
    @InjectRepository(AmenityEntity) private readonly amenities: Repository<AmenityEntity>,
    @InjectRepository(CategoryEntity) private readonly categoriesRepo: Repository<CategoryEntity>,
    @InjectRepository(GymScheduleEntity) private readonly schedules: Repository<GymScheduleEntity>,
    @InjectRepository(GymPlanEntity) private readonly gymPlans: Repository<GymPlanEntity>,
    @InjectRepository(TrainerBookingEntity) private readonly trainerBookings: Repository<TrainerBookingEntity>,
    @InjectRepository(TrainerEntity) private readonly trainers: Repository<TrainerEntity>,
  ) {}

  private safeGymQuery(alias = 'g', includeSensitive = false) {
    const qb = this.repo.createQueryBuilder(alias)
      .select(`${alias}.id`, 'id')
      .addSelect(`${alias}.name`, 'name')
      .addSelect(`${alias}.city`, 'city')
      .addSelect(`${alias}.area`, 'area')
      .addSelect(`${alias}.address`, 'address')
      .addSelect(`${alias}.description`, 'description')
      .addSelect(`${alias}.pinCode`, 'pinCode')
      .addSelect(`${alias}.contactPhone`, 'contactPhone')
      .addSelect(`${alias}.contactEmail`, 'contactEmail')
      .addSelect(`${alias}.website`, 'website')
      .addSelect(`${alias}.openingTime`, 'openingTime')
      .addSelect(`${alias}.closingTime`, 'closingTime')
      .addSelect(`${alias}.breakStartTime`, 'breakStartTime')
      .addSelect(`${alias}.breakEndTime`, 'breakEndTime')
      .addSelect(`${alias}.lat`, 'lat')
      .addSelect(`${alias}.lng`, 'lng')
      .addSelect(`${alias}.tier`, 'tier')
      .addSelect(`${alias}.rating`, 'rating')
      .addSelect(`${alias}.ratingCount`, 'ratingCount')
      .addSelect(`${alias}.status`, 'status')
      .addSelect(`${alias}.commissionRate`, 'commissionRate')
      .addSelect(`${alias}.coverPhoto`, 'coverPhoto')
      .addSelect(`${alias}.photos`, 'photos')
      .addSelect(`${alias}.amenities`, 'amenities')
      .addSelect(`${alias}.categories`, 'categories')
      .addSelect(`${alias}.ratePerDay`, 'ratePerDay')
      .addSelect(`${alias}.dayPassPrice`, 'dayPassPrice')
      .addSelect(`${alias}.sameGymMonthlyPrice`, 'sameGymMonthlyPrice')
      .addSelect(`${alias}.capacity`, 'capacity')
      .addSelect(`${alias}.ownerId`, 'ownerId')
      .addSelect(`${alias}.kycStatus`, 'kycStatus')
      .addSelect(`${alias}.createdAt`, 'createdAt')
      .addSelect(`${alias}.updatedAt`, 'updatedAt');
    if (includeSensitive) {
      qb.addSelect(`${alias}.kycDocuments`, 'kycDocuments')
        .addSelect(`${alias}.kycReviewNote`, 'kycReviewNote');
    }
    return qb;
  }

  private normalizeGym(row: any) {
    if (!row) return null;
    const openingTime = row.openingTime || '06:00';
    const closingTime = row.closingTime || '22:00';
    const photos = Array.isArray(row.photos) ? row.photos.filter(Boolean) : [];
    const coverPhoto = row.coverPhoto || photos[0] || null;
    return {
      ...row,
      distanceKm: row.distanceKm !== undefined && row.distanceKm !== null ? Math.round(Number(row.distanceKm) * 10) / 10 : undefined,
      distance: row.distanceKm !== undefined && row.distanceKm !== null ? `${(Math.round(Number(row.distanceKm) * 10) / 10).toFixed(1)} km` : undefined,
      coverPhoto,
      coverImage: coverPhoto,
      photos,
      images: photos.length > 0 ? photos : (coverPhoto ? [coverPhoto] : []),
      phone: row.contactPhone ?? null,
      email: row.contactEmail ?? null,
      openingHours: `${openingTime} - ${closingTime}`,
      breakHours: row.breakStartTime && row.breakEndTime ? `${row.breakStartTime} - ${row.breakEndTime}` : null,
      dayPassPrice: row.dayPassPrice ?? null,
      sameGymMonthlyPrice: row.sameGymMonthlyPrice ?? null,
    };
  }

  private async attachSchedule(row: any) {
    const normalized = this.normalizeGym(row);
    if (!normalized?.id) return normalized;
    const schedule = await this.schedules.find({ where: { gymId: normalized.id }, order: { dayOfWeek: 'ASC' } });
    if (schedule.length > 0) {
      normalized.operatingSchedule = schedule;
      const today = schedule[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || schedule.find((d) => d.isOpen);
      if (today) {
        normalized.openingTime = today.openTime;
        normalized.closingTime = today.closeTime;
        normalized.breakStartTime = today.breakStartTime;
        normalized.breakEndTime = today.breakEndTime;
        normalized.openingHours = today.isOpen ? `${today.openTime} - ${today.closeTime}` : 'Closed today';
        normalized.breakHours = today.breakStartTime && today.breakEndTime ? `${today.breakStartTime} - ${today.breakEndTime}` : null;
      }
    }
    return normalized;
  }

  private isTime(value: any) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private compactPatch(data: Record<string, any>) {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }

  private kycPhotoUrls(docs: any[] = []) {
    const urls = docs
      .filter((doc) => doc?.type === 'gym_photos')
      .flatMap((doc) => [
        doc?.fields?.exteriorPhotoUrl,
        doc?.fields?.interiorPhotoUrl,
        doc?.fields?.equipmentPhotoUrl,
        doc?.url,
      ])
      .filter((url) => typeof url === 'string' && url.trim().length > 0)
      .map((url) => url.trim());
    return [...new Set(urls)];
  }

  private sanitizeGymPatch(data: any, isAdmin = false): Partial<GymEntity> {
    const raw = data || {};
    const patch: any = {
      name: raw.name ?? raw.displayName,
      city: raw.city,
      area: raw.area,
      address: raw.address,
      description: raw.description,
      pinCode: raw.pinCode ?? raw.pincode,
      contactPhone: raw.contactPhone ?? raw.phone,
      contactEmail: raw.contactEmail ?? raw.email,
      website: raw.website,
      coverPhoto: raw.coverPhoto ?? raw.coverImage,
      photos: Array.isArray(raw.photos) ? raw.photos : (Array.isArray(raw.images) ? raw.images : undefined),
      amenities: Array.isArray(raw.amenities) ? raw.amenities : undefined,
      categories: Array.isArray(raw.categories) ? raw.categories : undefined,
      openingTime: raw.openingTime,
      closingTime: raw.closingTime,
      breakStartTime: raw.breakStartTime === '' ? null : raw.breakStartTime,
      breakEndTime: raw.breakEndTime === '' ? null : raw.breakEndTime,
      dayPassPrice: raw.dayPassPrice === '' ? null : raw.dayPassPrice,
      sameGymMonthlyPrice: raw.sameGymMonthlyPrice === '' ? null : raw.sameGymMonthlyPrice,
      capacity: raw.capacity,
      lat: raw.lat === '' ? undefined : raw.lat,
      lng: raw.lng === '' ? undefined : raw.lng,
    };

    if (raw.openingHours && (!patch.openingTime || !patch.closingTime)) {
      const [open, close] = String(raw.openingHours).split(/\s*-\s*/);
      patch.openingTime = patch.openingTime ?? open;
      patch.closingTime = patch.closingTime ?? close;
    }

    const clean = this.compactPatch(patch);
    for (const key of ['openingTime', 'closingTime', 'breakStartTime', 'breakEndTime']) {
      if (clean[key] !== null && clean[key] !== undefined && !this.isTime(clean[key])) {
        throw new BadRequestException(`${key} must be HH:MM`);
      }
    }
    if ((clean.breakStartTime && !clean.breakEndTime) || (!clean.breakStartTime && clean.breakEndTime)) {
      throw new BadRequestException('Both break start and break end time are required');
    }
    if (clean.breakStartTime && clean.breakEndTime && clean.breakStartTime >= clean.breakEndTime) {
      throw new BadRequestException('Break end time must be after break start time');
    }
    if (clean.openingTime && clean.closingTime && clean.openingTime >= clean.closingTime) {
      throw new BadRequestException('Closing time must be after opening time');
    }
    for (const key of ['dayPassPrice', 'sameGymMonthlyPrice', 'capacity', 'lat', 'lng']) {
      if (clean[key] !== null && clean[key] !== undefined) clean[key] = Number(clean[key]);
    }
    if (clean.lat !== undefined && (!Number.isFinite(clean.lat) || clean.lat < -90 || clean.lat > 90)) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }
    if (clean.lng !== undefined && (!Number.isFinite(clean.lng) || clean.lng < -180 || clean.lng > 180)) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }
    if (isAdmin) {
      const allowedStatuses = ['pending', 'active', 'suspended', 'rejected', 'inactive'];
      if (raw.status !== undefined && !allowedStatuses.includes(String(raw.status))) {
        throw new BadRequestException('Invalid gym status');
      }
      Object.assign(clean, this.compactPatch({
        tier: raw.tier,
        status: raw.status,
        commissionRate: raw.commissionRate,
        ratePerDay: raw.ratePerDay,
        ownerId: raw.ownerId,
        kycStatus: raw.kycStatus,
      }));
    }
    return clean;
  }

  private async assertGymAccess(id: string, user: any) {
    const gym = await this.repo.findOne({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');
    if (user?.role !== 'super_admin' && gym.ownerId !== user?.userId) {
      throw new ForbiddenException('Cannot update another gym');
    }
    return gym;
  }

  private async canonicalCategories(names: any[] | undefined) {
    if (!Array.isArray(names)) return undefined;
    const active = await this.categoriesRepo.find({ where: { isActive: true } });
    const byName = new Map(active.map((category) => [normalizeCatalogName(category.name), category.name.trim()]));
    const normalized = [...new Set(names.map((name) => byName.get(normalizeCatalogName(name))).filter(Boolean) as string[])];
    if (names.length > 0 && normalized.length === 0) {
      throw new BadRequestException('Select valid workout categories created by admin');
    }
    return normalized;
  }

  private readonly kycSchemas: Record<string, { label: string; fields: Array<{ key: string; label: string; type?: string; required?: boolean }> }> = {
    business_registration: {
      label: 'Business Registration',
      fields: [
        { key: 'legalName', label: 'Legal business name', required: true },
        { key: 'registrationNumber', label: 'Registration number', required: true },
        { key: 'businessType', label: 'Business type', required: true },
        { key: 'documentUrl', label: 'Registration document URL', type: 'url', required: true },
      ],
    },
    gst_certificate: {
      label: 'GST Certificate',
      fields: [
        { key: 'gstNumber', label: 'GST number', required: true },
        { key: 'registeredName', label: 'Registered name', required: true },
        { key: 'documentUrl', label: 'GST certificate URL', type: 'url', required: true },
      ],
    },
    bank_details: {
      label: 'Bank Details',
      fields: [
        { key: 'accountHolderName', label: 'Account holder name', required: true },
        { key: 'bankName', label: 'Bank name', required: true },
        { key: 'accountNumber', label: 'Account number', required: true },
        { key: 'ifsc', label: 'IFSC code', required: true },
        { key: 'cancelledChequeUrl', label: 'Cancelled cheque/passbook URL', type: 'url', required: true },
      ],
    },
    identity_document: {
      label: 'Owner Identity Document',
      fields: [
        { key: 'ownerName', label: 'Owner name', required: true },
        { key: 'documentType', label: 'Document type', required: true },
        { key: 'documentNumber', label: 'Document number', required: true },
        { key: 'documentUrl', label: 'Identity document URL', type: 'url', required: true },
      ],
    },
    gym_photos: {
      label: 'Gym Photos',
      fields: [
        { key: 'exteriorPhotoUrl', label: 'Exterior photo URL', type: 'url', required: true },
        { key: 'interiorPhotoUrl', label: 'Interior photo URL', type: 'url', required: true },
        { key: 'equipmentPhotoUrl', label: 'Equipment photo URL', type: 'url', required: false },
      ],
    },
    trainer_certs: {
      label: 'Trainer Certificates',
      fields: [
        { key: 'trainerName', label: 'Trainer name', required: true },
        { key: 'certificateName', label: 'Certificate name', required: true },
        { key: 'certificateUrl', label: 'Certificate URL', type: 'url', required: true },
      ],
    },
  };

  private recomputeKycStatus(docs: any[] = []) {
    const requiredTypes = Object.keys(this.kycSchemas);
    if (!docs.length) return 'not_started';
    const byType = new Map(docs.map((doc) => [doc.type, doc]));
    const allRequiredApproved = requiredTypes.every((type) => byType.get(type)?.status === 'approved');
    if (allRequiredApproved) return 'approved';
    if (docs.some((doc) => doc.status === 'in_review')) return 'in_review';
    if (docs.some((doc) => doc.status === 'rejected')) return 'rejected';
    return 'in_review';
  }

  private statusForKyc(kycStatus: string, currentStatus?: string): GymStatus {
    if (kycStatus === 'approved') return 'active';
    if (kycStatus === 'rejected') return 'rejected';
    if (currentStatus === 'active') return 'pending';
    return (currentStatus as GymStatus) || 'pending';
  }

  private paidSubscriptionStatuses() {
    return ['active', 'frozen', 'expired', 'cancelled'];
  }

  private money(value: any) {
    const amount = Number(value || 0);
    return Number.isFinite(amount) ? Math.round(amount) : 0;
  }

  private isPaidSubscription(sub: SubscriptionEntity) {
    return this.paidSubscriptionStatuses().includes(String(sub.status || '').toLowerCase());
  }

  private gymPlanAmount(sub: SubscriptionEntity, gym: any, plan?: GymPlanEntity | null) {
    if (!this.isPaidSubscription(sub)) return 0;
    if (sub.planType === 'same_gym') return this.money(plan?.price ?? gym.sameGymMonthlyPrice ?? 0);
    if (sub.planType === 'day_pass') return this.money(gym.dayPassPrice ?? 149);
    return 0;
  }

  private trainerGymAmount(booking: TrainerBookingEntity) {
    return this.money(Number(booking.amount || 0) - Number(booking.platformCommission || 0));
  }

  private gymSubscriptionsQuery(gymId: string) {
    return this.subs
      .createQueryBuilder('s')
      .leftJoin(UserEntity, 'u', 'u.id = s."userId"')
      .leftJoin(GymPlanEntity, 'gp', 'gp.id::text = s."gymPlanId" AND gp."gymId" = :gymId', { gymId })
      .where(new Brackets((where) => {
        where
          .where('CAST(:gymId AS uuid) = ANY(COALESCE(s."gymIds", ARRAY[]::uuid[]))', { gymId })
          .orWhere('gp.id IS NOT NULL')
          .orWhere(`(
            s."planType" = :multiGym
            AND EXISTS (
              SELECT 1
              FROM checkins c
              WHERE c."subscriptionId" = s.id
                AND c."gymId" = :gymId
                AND c.status = :checkinSuccess
            )
          )`, { multiGym: 'multi_gym', checkinSuccess: 'success' });
      }));
  }

  private async trainerAddonsByOrder(gymId: string, orderIds: string[]) {
    const ids = [...new Set(orderIds.filter(Boolean))];
    if (!ids.length) return { byOrder: new Map<string, any[]>(), amountByOrder: new Map<string, number>() };
    const bookings = await this.trainerBookings.find({ where: { gymId, cashfreeOrderId: In(ids) } });
    const trainerIds = [...new Set(bookings.map((b) => b.trainerId).filter(Boolean))];
    const trainers = trainerIds.length ? await this.trainers.find({ where: { id: In(trainerIds) } }) : [];
    const trainerMap = new Map(trainers.map((t) => [t.id, t]));
    const byOrder = new Map<string, any[]>();
    const amountByOrder = new Map<string, number>();
    for (const booking of bookings) {
      const trainer = trainerMap.get(booking.trainerId);
      const gymAmount = ['confirmed', 'completed', 'active'].includes(String(booking.status).toLowerCase())
        ? this.trainerGymAmount(booking)
        : 0;
      const item = {
        id: booking.id,
        trainerId: booking.trainerId,
        trainerName: trainer?.name || 'Assigned trainer',
        status: booking.status,
        durationMonths: booking.durationMonths,
        monthlyPrice: booking.durationMonths ? Math.round(gymAmount / Math.max(1, booking.durationMonths)) : gymAmount,
        gymAmount,
      };
      const rows = byOrder.get(booking.cashfreeOrderId) || [];
      rows.push(item);
      byOrder.set(booking.cashfreeOrderId, rows);
      amountByOrder.set(booking.cashfreeOrderId, (amountByOrder.get(booking.cashfreeOrderId) || 0) + gymAmount);
    }
    return { byOrder, amountByOrder };
  }

  private async multiGymVisitCounts(gymId: string, subIds: string[], from?: Date, to?: Date) {
    const ids = [...new Set(subIds.filter(Boolean))];
    if (!ids.length) return new Map<string, number>();
    const qb = this.checkins.createQueryBuilder('c')
      .select('c."subscriptionId"', 'subscriptionId')
      .addSelect('COUNT(DISTINCT (c."userId"::text || \':\' || DATE(c."checkinTime")::text))', 'count')
      .where('c."gymId" = :gymId', { gymId })
      .andWhere('c.status = :status', { status: 'success' })
      .andWhere('c."subscriptionId" IN (:...ids)', { ids });
    if (from && to) qb.andWhere('c."checkinTime" >= :from AND c."checkinTime" <= :to', { from, to });
    const rows = await qb.groupBy('c."subscriptionId"').getRawMany();
    return new Map(rows.map((row: any) => [row.subscriptionId, Number(row.count || 0)]));
  }

  private async trainerTotalsForGym(gymId: string, from?: Date, to?: Date) {
    const qb = this.trainerBookings.createQueryBuilder('tb')
      .where('tb."gymId" = :gymId', { gymId })
      .andWhere('tb.status IN (:...statuses)', { statuses: ['confirmed', 'completed', 'active'] });
    if (from && to) qb.andWhere('tb."createdAt" >= :from AND tb."createdAt" <= :to', { from, to });
    const bookings = await qb.getMany();
    return {
      count: bookings.length,
      gross: bookings.reduce((sum, b) => sum + this.money(b.amount), 0),
      gymAmount: bookings.reduce((sum, b) => sum + this.trainerGymAmount(b), 0),
      commission: bookings.reduce((sum, b) => sum + this.money(b.platformCommission), 0),
    };
  }

  async myGym(ownerId: string) {
    const row = await this.safeGymQuery('g').where('g."ownerId" = :ownerId', { ownerId }).getRawOne();
    return this.attachSchedule(row);
  }

  async myMembers(ownerId: string, opts: { page?: number; limit?: number; search?: string; status?: string } = {}) {
    const gym = await this.myGym(ownerId) as any;
    if (!gym) return { data: [], total: 0, page: 1, limit: 20, pages: 0 };
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const skip = (page - 1) * limit;

    const search = opts.search?.trim();

    const makeBaseQuery = () => this.gymSubscriptionsQuery(gym.id);

    const applySearch = (qb: ReturnType<typeof makeBaseQuery>) => {
      if (!search) return qb;
      return qb.andWhere(new Brackets((where) => {
        where
          .where('s."userId"::text ILIKE :q', { q: `%${search}%` })
          .orWhere('u.name ILIKE :q', { q: `%${search}%` })
          .orWhere('u.phone ILIKE :q', { q: `%${search}%` })
          .orWhere('u.email ILIKE :q', { q: `%${search}%` });
      }));
    };

    const applyStatus = (qb: ReturnType<typeof makeBaseQuery>) => {
      if (!opts.status || opts.status === 'all') return qb;
      if (opts.status === 'expired') return qb.andWhere('s."endDate" < CURRENT_DATE').andWhere('s.status != :cancelled', { cancelled: 'cancelled' });
      if (opts.status === 'active') {
        return qb.andWhere('s.status = :status', { status: 'active' }).andWhere('s."endDate" >= CURRENT_DATE');
      }
      return qb.andWhere('s.status = :status', { status: opts.status });
    };

    const qb = applyStatus(applySearch(makeBaseQuery())).orderBy('s.createdAt', 'DESC');
    const [subs, total] = await Promise.all([
      qb.clone().skip(skip).take(limit).getMany(),
      qb.clone().getCount(),
    ]);

    const statsBase = applySearch(makeBaseQuery());
    const [activeCount, pendingCount, expiredCount, cancelledCount] = await Promise.all([
      statsBase.clone().andWhere('s.status = :status', { status: 'active' }).andWhere('s."endDate" >= CURRENT_DATE').getCount(),
      statsBase.clone().andWhere('s.status = :status', { status: 'pending' }).getCount(),
      statsBase.clone().andWhere('s."endDate" < CURRENT_DATE').andWhere('s.status != :cancelled', { cancelled: 'cancelled' }).getCount(),
      statsBase.clone().andWhere('s.status = :status', { status: 'cancelled' }).getCount(),
    ]);

    // Enrich with today's check-in count per user
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const userIds = [...new Set(subs.map((s) => s.userId).filter(Boolean))];
    const gymPlanIds = [...new Set(subs.map((s) => s.gymPlanId).filter(Boolean))];
    const users = userIds.length ? await this.users.find({ where: { id: In(userIds) } }) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const planRows = gymPlanIds.length ? await this.gymPlans.find({ where: { id: In(gymPlanIds as string[]) } }) : [];
    const planMap = new Map(planRows.map((p) => [p.id, p]));
    const { byOrder: trainerAddonsByOrder, amountByOrder: trainerAmountByOrder } = await this.trainerAddonsByOrder(
      gym.id,
      subs.map((s) => s.razorpayOrderId).filter(Boolean),
    );
    const multiGymVisitCount = await this.multiGymVisitCounts(gym.id, subs.filter((s) => s.planType === 'multi_gym').map((s) => s.id));
    const ratePerDay = Number(gym.ratePerDay || 0);
    const todayRows = userIds.length ? await this.checkins
      .createQueryBuilder('c')
      .select('c."userId"', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('c."gymId" = :gymId', { gymId: gym.id })
      .andWhere('c.status = :status', { status: 'success' })
      .andWhere('c."checkinTime" >= :today AND c."checkinTime" < :tomorrow', { today, tomorrow })
      .andWhere('c."userId" IN (:...userIds)', { userIds })
      .groupBy('c."userId"')
      .getRawMany() : [];
    const todayCheckins = new Map(todayRows.map((row: any) => [row.userId, Number(row.count || 0)]));
    const todayIso = new Date().toISOString().slice(0, 10);

    const data = subs.map(s => {
      const user = userMap.get(s.userId);
      const gymPlan = s.gymPlanId ? planMap.get(s.gymPlanId) : null;
      const belongsByGymPlan = gymPlan?.gymId === gym.id;
      const isExpired = s.endDate ? String(s.endDate).slice(0, 10) < todayIso : false;
      const gymCount = Math.max((s.gymIds || []).length, belongsByGymPlan ? 1 : 0);
      const canDeactivate = s.planType !== 'multi_gym' && ((s.gymIds || []).includes(gym.id) || belongsByGymPlan);
      const subscriptionGymAmount = s.planType === 'multi_gym'
        ? this.money((multiGymVisitCount.get(s.id) || 0) * ratePerDay)
        : this.gymPlanAmount(s, gym, gymPlan);
      const trainerAddons = s.razorpayOrderId ? (trainerAddonsByOrder.get(s.razorpayOrderId) || []) : [];
      const trainerGymAmount = s.razorpayOrderId ? (trainerAmountByOrder.get(s.razorpayOrderId) || 0) : 0;
      (s as any).userPhone = user?.phone || user?.email || '-';
      return {
        id: s.id,
        userId: s.userId,
        name: user?.name || user?.email || `User-${s.userId.slice(0, 6)}`,
        phone: (s as any).userPhone || '—',
        planType: s.planType,
        planName: gymPlan?.name || null,
        gymType: s.planType === 'multi_gym' ? 'Multi Gym' : 'Single Gym',
        gymCount: s.planType === 'multi_gym' ? Math.max(gymCount, 1) : gymCount,
        status: s.status === 'cancelled' ? 'cancelled' : (isExpired ? 'expired' : s.status),
        subscriptionStatus: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        amountPaid: subscriptionGymAmount + trainerGymAmount,
        gymAmount: subscriptionGymAmount + trainerGymAmount,
        subscriptionGymAmount,
        trainerGymAmount,
        trainerAddons,
        hasTrainerAddon: trainerAddons.length > 0,
        trainerSummary: trainerAddons.length
          ? trainerAddons.map((addon) => `${addon.trainerName} (${addon.status})`).join(', ')
          : null,
        userPaidAmount: undefined,
        createdAt: s.createdAt,
        todayCheckins: todayCheckins.get(s.userId) || 0,
        canDeactivate,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      stats: { total, active: activeCount, pending: pendingCount, expired: expiredCount, cancelled: cancelledCount },
    };
  }

  async deactivateMember(ownerId: string, subId: string) {
    const gym = await this.myGym(ownerId) as any;
    if (!gym) throw new NotFoundException('Gym not found');
    const sub = await this.subs.findOne({ where: { id: subId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.planType === 'multi_gym') throw new ForbiddenException('Multi-gym passes are managed by the platform admin');
    const belongsByGymIds = (sub.gymIds || []).includes(gym.id);
    const plan = !belongsByGymIds && sub.gymPlanId
      ? await this.gymPlans.findOne({ where: { id: sub.gymPlanId } })
      : null;
    if (!belongsByGymIds && plan?.gymId !== gym.id) throw new NotFoundException('Member not in this gym');
    await this.subs.update(subId, { status: 'cancelled' as any });
    return { success: true, message: 'Member subscription deactivated' };
  }

  async myCheckins(ownerId: string, page: any = 1, limit: any = 20) {
    const gym = await this.myGym(ownerId) as any;
    if (!gym) return { data: [], total: 0, page: 1, limit: 20, pages: 0 };
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const [data, total] = await this.checkins.findAndCount({
      where: { gymId: gym.id },
      order: { checkinTime: 'DESC' },
      skip, take,
    });
    const subIds = [...new Set(data.map((c) => c.subscriptionId).filter(Boolean))];
    const userIds = [...new Set(data.map((c) => c.userId).filter(Boolean))];
    const [subs, users] = await Promise.all([
      subIds.length ? this.subs.find({ where: { id: In(subIds) } }) : [],
      userIds.length ? this.users.find({ where: { id: In(userIds) } }) : [],
    ]);
    const subMap = new Map<string, SubscriptionEntity>(subs.map((s): [string, SubscriptionEntity] => [s.id, s]));
    const userMap = new Map<string, UserEntity>(users.map((u): [string, UserEntity] => [u.id, u]));
    const ratePerDay = Number((gym as any).ratePerDay ?? 50);
    const gymShare = ratePerDay;
    const adminShare = 0;
    const enriched = data.map(c => {
      const sub = subMap.get(c.subscriptionId);
      const user = userMap.get(c.userId);
      return {
        ...c,
        planType: sub?.planType || null,
        userName: user?.name || null,
        userPhone: user?.phone || user?.email || null,
        ratePerDay,
        gymEarns: c.status === 'success' ? gymShare : 0,
        adminEarns: c.status === 'success' ? adminShare : 0,
      };
    });
    return { data: enriched, total, page: p, limit: l, pages: Math.ceil(total / l), gym: { name: gym.name, ratePerDay, commissionRate: 0, payoutMode: 'fixed_visit_payout' } };
  }

  async myTodayStats(ownerId: string) {
    const gym = await this.myGym(ownerId) as any;
    if (!gym) return { count: 0, recent: [] };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const recent = await this.checkins.find({
      where: { gymId: gym.id, status: 'success', checkinTime: Between(today, tomorrow) },
      order: { checkinTime: 'DESC' },
      take: 10,
    });
    return { count: recent.length, recent };
  }

  async myReport(ownerId: string, from?: string, to?: string) {
    const gym = await this.myGym(ownerId) as any;
    if (!gym) {
      return { totalCheckins: 0, uniqueMembers: 0, subscriberCount: 0, activeSubscribers: 0, peakHour: '--', revenueShare: 0, lifetimeGymEarned: 0, dailyCheckins: [], topMembers: [] };
    }
    const end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = from ? new Date(from) : new Date(end);
    if (!from) start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    const [rows, allSubs, periodSubs] = await Promise.all([
      this.checkins.find({
        where: { gymId: gym.id, status: 'success', checkinTime: Between(start, end) },
        order: { checkinTime: 'ASC' },
      }),
      this.gymSubscriptionsQuery(gym.id)
        .andWhere('s.status IN (:...statuses)', { statuses: this.paidSubscriptionStatuses() })
        .getMany(),
      this.gymSubscriptionsQuery(gym.id)
        .andWhere('s.status IN (:...statuses)', { statuses: this.paidSubscriptionStatuses() })
        .andWhere('s."createdAt" >= :start AND s."createdAt" <= :end', { start, end })
        .getMany(),
    ]);
    const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
    const subIds = [...new Set(rows.map((row) => row.subscriptionId).filter(Boolean))];
    const allReportSubs = [...allSubs, ...periodSubs];
    const gymPlanIds = [...new Set(allReportSubs.map((s) => s.gymPlanId).filter(Boolean))];
    const [users, subs] = await Promise.all([
      userIds.length ? this.users.find({ where: { id: In(userIds) } }) : [],
      subIds.length ? this.subs.find({ where: { id: In(subIds) } }) : [],
    ]);
    const plans = gymPlanIds.length ? await this.gymPlans.find({ where: { id: In(gymPlanIds as string[]) } }) : [];
    const planMap = new Map(plans.map((plan) => [plan.id, plan]));
    const userMap = new Map<string, UserEntity>(users.map((u): [string, UserEntity] => [u.id, u]));
    const subMap = new Map<string, SubscriptionEntity>(subs.map((s): [string, SubscriptionEntity] => [s.id, s]));
    const daily = new Map<string, number>();
    const hourly = new Map<number, number>();
    const members = new Map<string, { id: string; name: string; visits: number; plan: string; lastVisit: string }>();
    for (const row of rows) {
      const date = new Date(row.checkinTime);
      const key = date.toISOString().slice(0, 10);
      daily.set(key, (daily.get(key) || 0) + 1);
      hourly.set(date.getHours(), (hourly.get(date.getHours()) || 0) + 1);
      const user = userMap.get(row.userId);
      const sub = subMap.get(row.subscriptionId);
      const member = members.get(row.userId) || {
        id: row.userId,
        name: user?.name || user?.phone || user?.email || `Member ${String(row.userId).slice(0, 6)}`,
        visits: 0,
        plan: sub?.planType || 'Membership',
        lastVisit: '',
      };
      member.visits += 1;
      member.lastVisit = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      members.set(row.userId, member);
    }
    const dailyCheckins = Array.from(daily.entries()).map(([day, count]) => ({
      day: new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      count,
    }));
    const peak = Array.from(hourly.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const peakHour = peak === undefined ? '--' : `${String(peak).padStart(2, '0')}:00`;
    const ratePerDay = Number((gym as any).ratePerDay ?? 50);
    const directPlans = (list: SubscriptionEntity[]) => list.filter((sub) => sub.planType === 'same_gym' || sub.planType === 'day_pass');
    const totalForPlans = (list: SubscriptionEntity[]) => directPlans(list).reduce((sum, sub) => (
      sum + this.gymPlanAmount(sub, gym, sub.gymPlanId ? planMap.get(sub.gymPlanId) : null)
    ), 0);
    const sameGymRevenue = periodSubs
      .filter((sub) => sub.planType === 'same_gym')
      .reduce((sum, sub) => sum + this.gymPlanAmount(sub, gym, sub.gymPlanId ? planMap.get(sub.gymPlanId) : null), 0);
    const dayPassRevenue = periodSubs
      .filter((sub) => sub.planType === 'day_pass')
      .reduce((sum, sub) => sum + this.gymPlanAmount(sub, gym, sub.gymPlanId ? planMap.get(sub.gymPlanId) : null), 0);
    const periodMultiGymSubIds = [...new Set(rows
      .filter((row) => subMap.get(row.subscriptionId)?.planType === 'multi_gym')
      .map((row) => row.subscriptionId)
      .filter(Boolean))];
    const allMultiGymSubIds = allSubs.filter((sub) => sub.planType === 'multi_gym').map((sub) => sub.id);
    const [periodMultiVisits, lifetimeMultiVisits, periodTrainer, lifetimeTrainer] = await Promise.all([
      this.multiGymVisitCounts(gym.id, periodMultiGymSubIds, start, end),
      this.multiGymVisitCounts(gym.id, allMultiGymSubIds),
      this.trainerTotalsForGym(gym.id, start, end),
      this.trainerTotalsForGym(gym.id),
    ]);
    const multiGymRevenue = Array.from(periodMultiVisits.values()).reduce((sum, visits) => sum + visits * ratePerDay, 0);
    const lifetimeMultiGymRevenue = Array.from(lifetimeMultiVisits.values()).reduce((sum, visits) => sum + visits * ratePerDay, 0);
    const subscriptionRevenue = sameGymRevenue + dayPassRevenue;
    const periodGymEarned = subscriptionRevenue + multiGymRevenue + periodTrainer.gymAmount;
    const lifetimeGymEarned = totalForPlans(allSubs) + lifetimeMultiGymRevenue + lifetimeTrainer.gymAmount;
    const todayIso = new Date().toISOString().slice(0, 10);
    const subscriberCount = directPlans(allSubs).length;
    const activeSubscribers = directPlans(allSubs).filter((sub) => sub.status === 'active' && String(sub.endDate).slice(0, 10) >= todayIso).length;
    return {
      totalCheckins: rows.length,
      uniqueMembers: userIds.length,
      subscriberCount,
      activeSubscribers,
      peakHour,
      revenueShare: this.money(periodGymEarned),
      periodGymEarned: this.money(periodGymEarned),
      lifetimeGymEarned: this.money(lifetimeGymEarned),
      subscriptionRevenue: this.money(subscriptionRevenue),
      sameGymRevenue: this.money(sameGymRevenue),
      dayPassRevenue: this.money(dayPassRevenue),
      multiGymRevenue: this.money(multiGymRevenue),
      trainerRevenue: this.money(periodTrainer.gymAmount),
      trainerAddonsCount: periodTrainer.count,
      dailyCheckins,
      topMembers: Array.from(members.values()).sort((a, b) => b.visits - a.visits).slice(0, 10),
    };
  }

  private validCoordinate(lat: any, lng: any) {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
      && parsedLat >= -90 && parsedLat <= 90 && parsedLng >= -180 && parsedLng <= 180
      ? { lat: parsedLat, lng: parsedLng }
      : null;
  }

  async list(
    filter: { city?: string; status?: string; kycStatus?: string; search?: string; tier?: string; category?: string; lat?: string; lng?: string; sort?: string } = {},
    page: any = 1,
    limit: any = 20,
    options: { includeSensitive?: boolean; publicOnly?: boolean } = {},
  ) {
    const qb = this.safeGymQuery('g', !!options.includeSensitive);
    if (filter.city) qb.andWhere('g.city = :city', { city: filter.city });
    if (filter.status) qb.andWhere('g.status = :status', { status: filter.status });
    else if (options.publicOnly !== false) qb.andWhere('g.status = :status', { status: 'active' });
    if (filter.kycStatus) qb.andWhere('g."kycStatus" = :kycStatus', { kycStatus: filter.kycStatus });
    if (filter.search) qb.andWhere('g.name ILIKE :search', { search: `%${filter.search}%` });
    if (filter.tier) {
      // Map mobile display names to DB enum values
      const tierMap: Record<string, string> = {
        elite: 'corporate_exclusive',
        premium: 'premium',
        standard: 'standard',
        corporate_exclusive: 'corporate_exclusive',
      };
      qb.andWhere('g.tier = :tier', { tier: tierMap[filter.tier.toLowerCase()] ?? filter.tier.toLowerCase() });
    }
    if (filter.category) {
      qb.andWhere(`
        EXISTS (
          SELECT 1
          FROM unnest(COALESCE(g.categories, ARRAY[]::text[]) || COALESCE(g.amenities, ARRAY[]::text[])) AS cat(name)
          WHERE lower(cat.name) = lower(:category)
             OR regexp_replace(lower(cat.name), '[^a-z0-9]+', '', 'g') = regexp_replace(lower(:category), '[^a-z0-9]+', '', 'g')
        )
      `, { category: filter.category });
    }
    const location = this.validCoordinate(filter.lat, filter.lng);
    if (location) {
      qb.addSelect(
        `(6371 * acos(least(1, greatest(-1, cos(radians(:lat)) * cos(radians(g.lat)) * cos(radians(g.lng) - radians(:lng)) + sin(radians(:lat)) * sin(radians(g.lat))))))`,
        'distanceKm',
      ).setParameters(location);
    }
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const orderColumn = location && filter.sort === 'nearest' ? '"distanceKm"' : (filter.kycStatus ? 'g.updatedAt' : 'g.rating');
    const [data, total] = await Promise.all([
      qb.clone().orderBy(orderColumn, orderColumn === '"distanceKm"' ? 'ASC' : 'DESC').skip(skip).take(take).getRawMany(),
      qb.clone().getCount(),
    ]);
    return paginatedResponse(data.map((row) => this.normalizeGym(row)), total, p, l);
  }

  async get(id: string) {
    const row = await this.safeGymQuery('g').where('g.id = :id', { id }).getRawOne();
    return this.attachSchedule(row);
  }

  async adminList(filter: { city?: string; status?: string; kycStatus?: string; search?: string; tier?: string; category?: string } = {}, page: any = 1, limit: any = 20) {
    return this.list(filter, page, limit, { includeSensitive: true, publicOnly: false });
  }

  async create(data: Partial<GymEntity>) {
    const patch = this.sanitizeGymPatch(data, true);
    const categories = await this.canonicalCategories((data as any)?.categories);
    if (categories !== undefined) (patch as any).categories = categories;
    return this.repo.save(this.repo.create(patch));
  }

  async update(id: string, data: Partial<GymEntity>, user: any) {
    await this.assertGymAccess(id, user);
    const patch = this.sanitizeGymPatch(data, user?.role === 'super_admin');
    const categories = await this.canonicalCategories((data as any)?.categories);
    if (categories !== undefined) (patch as any).categories = categories;
    await this.repo.update(id, patch);
    await this.syncProfileHoursToSchedule(id, patch as any);
    return this.get(id);
  }

  private async syncProfileHoursToSchedule(gymId: string, patch: any) {
    const touchesHours = ['openingTime', 'closingTime', 'breakStartTime', 'breakEndTime'].some((key) => key in patch);
    if (!touchesHours) return;
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      let row = await this.schedules.findOne({ where: { gymId, dayOfWeek } });
      if (!row) {
        row = this.schedules.create({
          gymId,
          dayOfWeek,
          isOpen: dayOfWeek < 6,
          openTime: patch.openingTime || '06:00',
          closeTime: patch.closingTime || '22:00',
          breakStartTime: patch.breakStartTime ?? null,
          breakEndTime: patch.breakEndTime ?? null,
        });
      } else {
        if (patch.openingTime) row.openTime = patch.openingTime;
        if (patch.closingTime) row.closeTime = patch.closingTime;
        if ('breakStartTime' in patch) row.breakStartTime = patch.breakStartTime ?? null;
        if ('breakEndTime' in patch) row.breakEndTime = patch.breakEndTime ?? null;
      }
      await this.schedules.save(row);
    }
  }

  async updateMyAmenities(ownerId: string, names: string[]) {
    const gym = await this.repo.findOne({ where: { ownerId } });
    if (!gym) throw new NotFoundException('Gym not found');
    const active = await this.amenities.find({ where: { isActive: true, status: 'approved' } });
    const byName = new Map(active.map((a) => [a.name.trim().toLowerCase(), a.name.trim()]));
    const normalized = [...new Set((names || []).map((n) => byName.get(String(n).trim().toLowerCase())).filter(Boolean) as string[])];
    await this.repo.update(gym.id, { amenities: normalized });
    return { success: true, amenities: normalized };
  }

  async approve(id: string) {
    const gym = await this.repo.findOne({ where: { id } });
    const docs = (gym?.kycDocuments || []).map((d: any) => ({
      ...d,
      status: 'approved',
      reviewedAt: new Date().toISOString(),
    }));
    const kycPhotos = this.kycPhotoUrls(docs);
    const existingPhotos = Array.isArray(gym?.photos) ? gym.photos.filter(Boolean) : [];
    const photos = [...new Set([...existingPhotos, ...kycPhotos])];
    await this.repo.update(id, {
      status: 'active' as GymStatus,
      kycStatus: 'approved',
      kycDocuments: docs,
      kycReviewNote: null,
      coverPhoto: gym?.coverPhoto || photos[0] || null,
      photos,
    });
    return this.get(id);
  }

  async reject(id: string, reason?: string) {
    const gym = await this.repo.findOne({ where: { id } });
    const docs = (gym?.kycDocuments || []).map((d: any) => ({
      ...d,
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewNote: reason || d.reviewNote,
    }));
    await this.repo.update(id, { status: 'rejected' as GymStatus, kycStatus: 'rejected', kycDocuments: docs, kycReviewNote: reason || null });
    return this.get(id);
  }

  async reviewKycDocument(id: string, type: string, body: { status: 'approved' | 'rejected'; reason?: string }, user: any) {
    const gym = await this.repo.findOne({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');
    if (!this.kycSchemas[type]) throw new BadRequestException('Invalid KYC type');
    if (!['approved', 'rejected'].includes(body?.status)) throw new BadRequestException('Status must be approved or rejected');
    const docs = [...(gym.kycDocuments || [])];
    const index = docs.findIndex((doc: any) => doc.type === type);
    if (index < 0) throw new NotFoundException('KYC document not submitted');
    docs[index] = {
      ...docs[index],
      status: body.status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user?.userId || null,
      reviewNote: body.status === 'rejected' ? (body.reason || 'Rejected by admin') : null,
    };
    const kycStatus = this.recomputeKycStatus(docs);
    const kycPhotos = kycStatus === 'approved' ? this.kycPhotoUrls(docs) : [];
    const existingPhotos = Array.isArray(gym.photos) ? gym.photos.filter(Boolean) : [];
    const photos = kycStatus === 'approved' ? [...new Set([...existingPhotos, ...kycPhotos])] : existingPhotos;
    await this.repo.update(id, {
      status: this.statusForKyc(kycStatus, gym.status),
      kycStatus,
      kycDocuments: docs,
      kycReviewNote: kycStatus === 'rejected' ? (body.reason || 'One or more KYC documents were rejected') : null,
      coverPhoto: kycStatus === 'approved' ? (gym.coverPhoto || photos[0] || null) : gym.coverPhoto,
      photos,
    });
    return this.getKycStatus(id);
  }

  async suspend(id: string) {
    return this.setStatus(id, 'suspended');
  }

  async setStatus(id: string, status: GymStatus) {
    const allowedStatuses: GymStatus[] = ['pending', 'active', 'suspended', 'rejected', 'inactive'];
    if (!allowedStatuses.includes(status)) throw new BadRequestException('Invalid gym status');
    await this.repo.update(id, { status });
    return this.get(id);
  }

  async setTier(id: string, tier: string, commissionRate: number) {
    await this.repo.update(id, { tier: tier as any, commissionRate });
    return this.get(id);
  }

  async submitKycDocument(gymId: string, doc: { name?: string; url?: string; type: string; fields?: Record<string, any> }, user: any) {
    const gym = await this.assertGymAccess(gymId, user);
    if (!gym) throw new NotFoundException('Gym not found');
    const schema = this.kycSchemas[doc.type];
    if (!schema) throw new BadRequestException('Invalid KYC type');
    const fields = doc.fields || {};
    for (const field of schema.fields) {
      if (field.required && !String(fields[field.key] ?? '').trim()) {
        throw new BadRequestException(`${field.label} is required`);
      }
    }
    const docs = gym.kycDocuments || [];
    const url = doc.url || fields.documentUrl || fields.cancelledChequeUrl || fields.exteriorPhotoUrl || fields.certificateUrl;
    const name = doc.name || schema.label;
    const nextDoc = { type: doc.type, name, url, fields, status: 'in_review' as const, uploadedAt: new Date().toISOString() };
    const existingIndex = docs.findIndex((d: any) => d.type === doc.type);
    if (existingIndex >= 0) docs[existingIndex] = nextDoc;
    else docs.push(nextDoc);
    await this.repo.update(gymId, { kycDocuments: docs, kycStatus: 'in_review', kycReviewNote: null });
    return { success: true, documents: docs };
  }

  async getKycStatus(gymId: string) {
    const row = await this.safeGymQuery('g', true).where('g.id = :id', { id: gymId }).getRawOne();
    const gym = await this.attachSchedule(row) as any;
    return { kycStatus: gym?.kycStatus || 'not_started', kycReviewNote: gym?.kycReviewNote || null, kycDocuments: gym?.kycDocuments || [], schemas: this.kycSchemas };
  }

  async getKycStatusForUser(gymId: string, user: any) {
    await this.assertGymAccess(gymId, user);
    return this.getKycStatus(gymId);
  }

  async getRecommended(userId: string) {
    const subs = await this.subs.find({ where: { userId }, take: 5, order: { createdAt: 'DESC' } });
    const gymIds = subs.map(s => (s.gymIds || [])).flat();

    const usedGyms = gymIds.length > 0
      ? await this.safeGymQuery('g').where('g.id IN (:...ids)', { ids: gymIds.slice(0, 3) }).getRawMany()
      : [];
    const preferredCities = [...new Set(usedGyms.map(g => g.city).filter(Boolean))];
    const preferredCategories = [...new Set(usedGyms.map(g => g.categories || []).flat().filter(Boolean))];

    const excludeIds = gymIds.length > 0 ? gymIds : ['00000000-0000-0000-0000-000000000000'];

    const qb = this.safeGymQuery('gym')
      .where('gym.status = :status', { status: 'active' })
      .andWhere('gym.id NOT IN (:...usedIds)', { usedIds: excludeIds })
      .orderBy('gym.rating', 'DESC')
      .take(10);

    if (preferredCities.length > 0) {
      qb.orWhere('gym.city IN (:...cities)', { cities: preferredCities });
    }
    if (preferredCategories.length > 0) {
      qb.orWhere('gym.city IN (:...cats)', { cats: preferredCategories });
    }

    const recommended = await qb.getRawMany();

    if (recommended.length < 5) {
      const topRated = await this.safeGymQuery('g')
        .where('g.status = :status', { status: 'active' })
        .orderBy('g.rating', 'DESC')
        .take(10)
        .getRawMany();
      const existing = new Set(recommended.map(g => g.id));
      for (const g of topRated) {
        if (!existing.has(g.id)) recommended.push(g);
        if (recommended.length >= 10) break;
      }
    }
    return recommended.slice(0, 10).map((row) => this.normalizeGym(row));
  }
}

@ApiTags('Gyms')
@Controller('gyms')
class GymsController {
  constructor(private readonly svc: GymsService) {}
  @Get('my-gym') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  myGym(@Req() req: any) { return this.svc.myGym(req.user.userId); }

  @Get('my-members') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  myMembers(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) { return this.svc.myMembers(req.user.userId, { page: +page, limit: +limit, search, status }); }

  @Patch('my-members/:subId/deactivate') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  deactivateMember(@Req() req: any, @Param('subId') subId: string) {
    return this.svc.deactivateMember(req.user.userId, subId);
  }

  @Get('my-checkins') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  myCheckins(@Req() req: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.svc.myCheckins(req.user.userId, +page, +limit);
  }

  @Get('my-checkins/today') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  myTodayStats(@Req() req: any) { return this.svc.myTodayStats(req.user.userId); }

  @Get('my-report') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  myReport(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.myReport(req.user.userId, from, to);
  }

  @Put('my-gym/amenities') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  updateMyAmenities(@Req() req: any, @Body() body: { amenities: string[] }) {
    return this.svc.updateMyAmenities(req.user.userId, body.amenities || []);
  }

  @Get() list(
    @Query('city') city?: string,
    @Query('status') status?: string,
    @Query('kycStatus') kycStatus?: string,
    @Query('search') search?: string,
    @Query('tier') tier?: string,
    @Query('category') category?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('sort') sort?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.list({ city, status, kycStatus, search, tier, category, lat, lng, sort }, +page, +limit, { publicOnly: true });
  }

  @Get('admin/list') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  adminList(
    @Query('city') city?: string,
    @Query('status') status?: string,
    @Query('kycStatus') kycStatus?: string,
    @Query('search') search?: string,
    @Query('tier') tier?: string,
    @Query('category') category?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.adminList({ city, status, kycStatus, search, tier, category }, +page, +limit);
  }
  @Get('recommended') @UseGuards(JwtAuthGuard)
  recommended(@Req() req: any) { return this.svc.getRecommended(req.user.userId); }

  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin', 'gym_owner')
  create(@Body() body: Partial<GymEntity>) { return this.svc.create(body); }

  @Put(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin', 'gym_owner')
  update(@Param('id') id: string, @Body() body: Partial<GymEntity>, @Req() req: any) { return this.svc.update(id, body, req.user); }

  @Post(':id/approve') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  approve(@Param('id') id: string) { return this.svc.approve(id); }

  @Post(':id/reject') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  reject(@Param('id') id: string, @Body() body: any) { return this.svc.reject(id, body?.reason); }

  @Post(':id/suspend') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  suspend(@Param('id') id: string) { return this.svc.suspend(id); }

  @Post(':id/activate') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  activate(@Param('id') id: string) { return this.svc.setStatus(id, 'active'); }

  @Post(':id/deactivate') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  deactivate(@Param('id') id: string) { return this.svc.setStatus(id, 'inactive'); }

  @Post(':id/tier') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  @Put(':id/tier')
  setTier(@Param('id') id: string, @Body() b: { tier: string; commissionRate: number }) {
    return this.svc.setTier(id, b.tier, b.commissionRate);
  }

  @Get(':id/kyc') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin', 'gym_owner', 'gym_staff')
  getKyc(@Param('id') id: string, @Req() req: any) { return this.svc.getKycStatusForUser(id, req.user); }

  @Post(':id/kyc-documents') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  submitKyc(@Param('id') id: string, @Body() body: any, @Req() req: any) { return this.svc.submitKycDocument(id, body, req.user); }

  @Patch(':id/kyc-documents/:type/review') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  reviewKyc(@Param('id') id: string, @Param('type') type: string, @Body() body: any, @Req() req: any) {
    return this.svc.reviewKycDocument(id, type, body, req.user);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([GymEntity, GymPlanEntity, SubscriptionEntity, UserEntity, CheckinEntity, AmenityEntity, CategoryEntity, GymScheduleEntity, TrainerBookingEntity, TrainerEntity])],
  controllers: [GymsController],
  providers: [GymsService],
  exports: [GymsService],
})
export class GymsModule {}
