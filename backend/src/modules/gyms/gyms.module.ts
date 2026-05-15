import { Module, Controller, Get, Post, Put, Patch, Param, Body, Query, Injectable, UseGuards, Req, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Brackets, In } from 'typeorm';
import { paginate, paginatedResponse } from '../../common/pagination.helper';
import { ApiTags } from '@nestjs/swagger';
import { GymEntity, GymPlanEntity, GymStatus } from '../../database/entities/gym.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { CheckinEntity } from '../../database/entities/checkin.entity';
import { AmenityEntity } from '../../database/entities/misc.entity';
import { GymScheduleEntity } from '../../database/entities/gym-schedule.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';

@Injectable()
class GymsService {
  constructor(
    @InjectRepository(GymEntity) private readonly repo: Repository<GymEntity>,
    @InjectRepository(SubscriptionEntity) private readonly subs: Repository<SubscriptionEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(CheckinEntity) private readonly checkins: Repository<CheckinEntity>,
    @InjectRepository(AmenityEntity) private readonly amenities: Repository<AmenityEntity>,
    @InjectRepository(GymScheduleEntity) private readonly schedules: Repository<GymScheduleEntity>,
    @InjectRepository(GymPlanEntity) private readonly gymPlans: Repository<GymPlanEntity>,
  ) {}

  private safeGymQuery(alias = 'g') {
    return this.repo.createQueryBuilder(alias)
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
      .addSelect(`${alias}.kycDocuments`, 'kycDocuments')
      .addSelect(`${alias}.kycStatus`, 'kycStatus')
      .addSelect(`${alias}.kycReviewNote`, 'kycReviewNote')
      .addSelect(`${alias}.createdAt`, 'createdAt')
      .addSelect(`${alias}.updatedAt`, 'updatedAt');
  }

  private normalizeGym(row: any) {
    if (!row) return null;
    const openingTime = row.openingTime || '06:00';
    const closingTime = row.closingTime || '22:00';
    const photos = Array.isArray(row.photos) ? row.photos.filter(Boolean) : [];
    const coverPhoto = row.coverPhoto || photos[0] || null;
    return {
      ...row,
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
      lat: raw.lat,
      lng: raw.lng,
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
    if (isAdmin) {
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

    const makeBaseQuery = () => this.subs
      .createQueryBuilder('s')
      .leftJoin(UserEntity, 'u', 'u.id = s."userId"')
      .leftJoin(GymPlanEntity, 'gp', 'gp.id = s."gymPlanId" AND gp."gymId" = :gymId', { gymId: gym.id })
      .where(new Brackets((where) => {
        where
          .where(':gymId = ANY(s."gymIds")', { gymId: gym.id })
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
    const [subs, total] = await qb.skip(skip).take(limit).getManyAndCount();

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
        amountPaid: s.amountPaid,
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
    const commissionRate = Number(gym.commissionRate ?? 15) / 100;
    const gymShare = ratePerDay * (1 - commissionRate);
    const adminShare = ratePerDay * commissionRate;
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
    return { data: enriched, total, page: p, limit: l, pages: Math.ceil(total / l), gym: { name: gym.name, ratePerDay, commissionRate: gym.commissionRate } };
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

  async list(filter: { city?: string; status?: string; kycStatus?: string; search?: string; tier?: string; category?: string } = {}, page: any = 1, limit: any = 20) {
    const qb = this.safeGymQuery('g');
    if (filter.city) qb.andWhere('g.city = :city', { city: filter.city });
    if (filter.status) qb.andWhere('g.status = :status', { status: filter.status });
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
    if (filter.category) qb.andWhere(':category = ANY(g.categories)', { category: filter.category });
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const orderColumn = filter.kycStatus ? 'g.updatedAt' : 'g.rating';
    const [data, total] = await Promise.all([
      qb.clone().orderBy(orderColumn, 'DESC').skip(skip).take(take).getRawMany(),
      qb.clone().getCount(),
    ]);
    return paginatedResponse(data.map((row) => this.normalizeGym(row)), total, p, l);
  }

  async get(id: string) {
    const row = await this.safeGymQuery('g').where('g.id = :id', { id }).getRawOne();
    return this.attachSchedule(row);
  }

  create(data: Partial<GymEntity>) { return this.repo.save(this.repo.create(this.sanitizeGymPatch(data, true))); }

  async update(id: string, data: Partial<GymEntity>, user: any) {
    await this.assertGymAccess(id, user);
    const patch = this.sanitizeGymPatch(data, user?.role === 'super_admin');
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

  async suspend(id: string) {
    await this.repo.update(id, { status: 'suspended' as GymStatus });
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
    const gym = await this.get(gymId) as any;
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
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.list({ city, status, kycStatus, search, tier, category }, +page, +limit);
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

  @Post(':id/tier') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  @Put(':id/tier')
  setTier(@Param('id') id: string, @Body() b: { tier: string; commissionRate: number }) {
    return this.svc.setTier(id, b.tier, b.commissionRate);
  }

  @Get(':id/kyc') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin', 'gym_owner', 'gym_staff')
  getKyc(@Param('id') id: string, @Req() req: any) { return this.svc.getKycStatusForUser(id, req.user); }

  @Post(':id/kyc-documents') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  submitKyc(@Param('id') id: string, @Body() body: any, @Req() req: any) { return this.svc.submitKycDocument(id, body, req.user); }
}

@Module({
  imports: [TypeOrmModule.forFeature([GymEntity, GymPlanEntity, SubscriptionEntity, UserEntity, CheckinEntity, AmenityEntity, GymScheduleEntity])],
  controllers: [GymsController],
  providers: [GymsService],
  exports: [GymsService],
})
export class GymsModule {}
