import { Module, Controller, Get, Post, Put, Delete, Param, Body, Query, Injectable, BadRequestException, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { paginate, paginatedResponse } from '../../common/pagination.helper';
import { ApiTags } from '@nestjs/swagger';
import {
  RatingEntity, CouponEntity, NotificationEntity,
  CategoryEntity, AmenityEntity, WorkoutVideoEntity, FraudAlertEntity,
} from '../../database/entities/misc.entity';
import { CheckinEntity } from '../../database/entities/checkin.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { GymEntity } from '../../database/entities/gym.entity';
import { AppConfigEntity } from '../../database/entities/app-config.entity';
import { ProductEntity } from '../../database/entities/store.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';

// ============ Ratings ============
@Injectable()
class RatingsService {
  constructor(
    @InjectRepository(RatingEntity) private readonly repo: Repository<RatingEntity>,
    @InjectRepository(CheckinEntity) private readonly checkins: Repository<CheckinEntity>,
  ) {}
  async submit(userId: string, targetType: 'gym' | 'trainer' | 'wellness', targetId: string, stars: number, review?: string) {
    if (stars < 1 || stars > 5) throw new BadRequestException('Stars must be 1-5');
    // Eligibility: must have at least 1 successful check-in (for gym)
    if (targetType === 'gym') {
      const hasCheckin = await this.checkins.count({ where: { userId, gymId: targetId, status: 'success' } });
      if (hasCheckin === 0) throw new BadRequestException('Must check in at least once to rate');
    }
    const data: any = { userId, stars, review, status: 'pending' };
    if (targetType === 'gym') data.gymId = targetId;
    if (targetType === 'trainer') data.trainerId = targetId;
    if (targetType === 'wellness') data.wellnessPartnerId = targetId;
    return this.repo.save(this.repo.create(data));
  }
  moderate(id: string, approve: boolean) {
    return this.repo.update(id, { status: approve ? 'approved' : 'rejected' });
  }
  listPending() { return this.repo.find({ where: { status: 'pending' }, order: { createdAt: 'DESC' } }); }
  listByStatus(status?: string) {
    const where: any = status ? { status } : {};
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }
  listForGym(gymId: string) { return this.repo.find({ where: { gymId, status: 'approved' }, order: { createdAt: 'DESC' } }); }
}

// ============ Coupons ============
@Injectable()
class CouponsService {
  constructor(@InjectRepository(CouponEntity) private readonly repo: Repository<CouponEntity>) {}
  list() { return this.repo.find({ order: { createdAt: 'DESC' } }); }
  create(d: Partial<CouponEntity>) { return this.repo.save(this.repo.create(d)); }
  async validate(code: string, amount: number, kind: string) {
    const c = await this.repo.findOne({ where: { code, isActive: true } });
    if (!c) throw new BadRequestException('Invalid coupon');
    const now = new Date();
    if (now < new Date(c.validFrom) || now > new Date(c.validTo)) throw new BadRequestException('Expired');
    if (c.usageLimit > 0 && c.usedCount >= c.usageLimit) throw new BadRequestException('Limit reached');
    if (amount < Number(c.minOrderValue)) throw new BadRequestException(`Min order ₹${c.minOrderValue}`);
    if (c.applicableTo?.length && !c.applicableTo.includes(kind)) throw new BadRequestException('Not applicable');
    let discount = c.discountType === 'percentage' ? amount * (Number(c.discountValue) / 100) : Number(c.discountValue);
    if (c.maxDiscount) discount = Math.min(discount, Number(c.maxDiscount));
    return { valid: true, discount, coupon: c.code };
  }
}

// ============ Notifications ============
@Injectable()
class NotificationsService {
  constructor(@InjectRepository(NotificationEntity) private readonly repo: Repository<NotificationEntity>) {}
  send(userId: string, title: string, body: string, type = 'general', data: any = {}) {
    // TODO: integrate FCM push
    return this.repo.save(this.repo.create({ userId, title, body, type, data }));
  }
  broadcast(userIds: string[], title: string, body: string) {
    return Promise.all(userIds.map((u) => this.send(u, title, body, 'broadcast')));
  }
  async listForUser(userId: string, page: any = 1, limit: any = 20) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const [data, total] = await this.repo.findAndCount({ where: { userId }, order: { createdAt: 'DESC' }, skip, take });
    return paginatedResponse(data, total, p, l);
  }
  markRead(id: string) { return this.repo.update(id, { isRead: true }); }
}

// ============ Master Data (categories, amenities) ============
@Injectable()
class MasterDataService {
  constructor(
    @InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(AmenityEntity) private readonly amenities: Repository<AmenityEntity>,
    @InjectRepository(GymEntity) private readonly gyms: Repository<GymEntity>,
  ) {}
  listCategories() { return this.categories.find({ where: { isActive: true } }); }
  createCategory(d: Partial<CategoryEntity>) { return this.categories.save(this.categories.create(d)); }
  listAmenities(includeAll = false) {
    return this.amenities.find({
      where: includeAll ? {} : { isActive: true, status: 'approved' },
      order: { name: 'ASC' },
    });
  }
  async createAmenity(d: Partial<AmenityEntity>) {
    const clean = d.name?.trim();
    if (!clean) throw new BadRequestException('Amenity name is required');
    const existing = await this.amenities.findOne({ where: { name: clean } });
    if (existing) {
      await this.amenities.update(existing.id, {
        ...d,
        name: clean,
        status: 'approved',
        isActive: true,
        requestedByGym: false,
        requestedByGymId: null,
        requestedByUserId: null,
      });
      return this.amenities.findOne({ where: { id: existing.id } });
    }
    return this.amenities.save(this.amenities.create({ ...d, name: clean, status: 'approved', isActive: true }));
  }
  async requestAmenity(name: string, gymId?: string, userId?: string) {
    const clean = name?.trim();
    if (!clean) throw new BadRequestException('Amenity name is required');
    const existing = await this.amenities.findOne({ where: { name: clean } });
    if (existing) return existing;
    return this.amenities.save(this.amenities.create({
      name: clean,
      requestedByGym: true,
      requestedByGymId: gymId || null,
      requestedByUserId: userId || null,
      status: 'pending',
      isActive: false,
    }));
  }
  async requestAmenityForUser(name: string, userId?: string) {
    const gym = userId ? await this.gyms.findOne({ where: { ownerId: userId } }) : null;
    return this.requestAmenity(name, gym?.id, userId);
  }
  async listAmenityRequestsForUser(userId?: string) {
    if (!userId) return [];
    const gym = await this.gyms.findOne({ where: { ownerId: userId } });
    const where: any[] = [{ requestedByUserId: userId }];
    if (gym?.id) where.push({ requestedByGymId: gym.id });
    return this.amenities.find({ where, order: { name: 'ASC' } });
  }
  approveAmenity(id: string) { return this.amenities.update(id, { status: 'approved', isActive: true }); }
  deleteCategory(id: string) { return this.categories.update(id, { isActive: false } as any); }
  rejectOrDeleteAmenity(id: string) { return this.amenities.update(id, { status: 'rejected', isActive: false } as any); }
}

// ============ Videos ============
@Injectable()
class VideosService {
  constructor(@InjectRepository(WorkoutVideoEntity) private readonly repo: Repository<WorkoutVideoEntity>) {}
  list(category?: string) {
    return this.repo.find({ where: category ? { category } : {}, order: { createdAt: 'DESC' } });
  }
  create(d: Partial<WorkoutVideoEntity>) { return this.repo.save(this.repo.create(d)); }
}

// ============ Analytics ============
@Injectable()
class AnalyticsService {
  constructor(
    @InjectRepository(SubscriptionEntity) private readonly subs: Repository<SubscriptionEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(CheckinEntity) private readonly checkins: Repository<CheckinEntity>,
    @InjectRepository(GymEntity) private readonly gyms: Repository<GymEntity>,
  ) {}

  async summary() {
    const [totalRevenue, activeSubscribers, totalUsers, totalCheckins] = await Promise.all([
      this.subs.createQueryBuilder('s').select('SUM(s."amountPaid")', 'total').getRawOne().then((r) => Number(r?.total || 0)),
      this.subs.count({ where: { status: 'active' } }),
      this.users.count(),
      this.checkins.count({ where: { status: 'success' } }),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newSignups = await this.users
      .createQueryBuilder('u')
      .where('u.createdAt >= :since', { since: thirtyDaysAgo })
      .getCount();

    const avgCheckinsPerDay = totalCheckins > 0 ? Math.round(totalCheckins / 30) : 0;

    const topGyms = await this.checkins
      .createQueryBuilder('c')
      .select('c.gymId', 'gymId')
      .addSelect('COUNT(*)', 'checkins')
      .where('c.status = :st', { st: 'success' })
      .groupBy('c.gymId')
      .orderBy('"checkins"', 'DESC')
      .limit(5)
      .getRawMany();

    const topPlans = await this.subs
      .createQueryBuilder('s')
      .select('s.planType', 'name')
      .addSelect('COUNT(*)', 'subscribers')
      .addSelect('SUM(s."amountPaid")', 'revenue')
      .groupBy('s.planType')
      .orderBy('"subscribers"', 'DESC')
      .getRawMany();

    const monthlyRevenue = await this.subs
      .createQueryBuilder('s')
      .select("TO_CHAR(s.\"createdAt\", 'YYYY-MM')", 'month')
      .addSelect('SUM(s."amountPaid")', 'revenue')
      .groupBy("TO_CHAR(s.\"createdAt\", 'YYYY-MM')")
      .orderBy('month', 'DESC')
      .limit(12)
      .getRawMany();

    return { totalRevenue, activeSubscribers, totalUsers, newSignups, avgCheckinsPerDay, topGyms, topPlans, monthlyRevenue };
  }
}

// ============ Controllers ============
@ApiTags('Ratings')
@Controller('ratings')
class RatingsController {
  constructor(private readonly svc: RatingsService) {}
  @Post() submit(@Body() b: any) { return this.svc.submit(b.userId, b.targetType, b.targetId, b.stars, b.review); }
  @Post(':id/approve') approve(@Param('id') id: string) { return this.svc.moderate(id, true); }
  @Post(':id/reject') reject(@Param('id') id: string) { return this.svc.moderate(id, false); }
  @Get('pending') pending() { return this.svc.listPending(); }
  @Get('gym/:gymId') forGym(@Param('gymId') gymId: string) { return this.svc.listForGym(gymId); }
  /** Admin list with optional ?status=pending|approved|rejected filter */
  @Get() list(@Query('status') status?: string) { return this.svc.listByStatus(status); }
}

@ApiTags('Coupons')
@Controller('coupons')
class CouponsController {
  constructor(private readonly svc: CouponsService) {}
  @Get() list() { return this.svc.list(); }
  @Post() create(@Body() b: any) { return this.svc.create(b); }
  @Post('validate') validate(@Body() b: any) { return this.svc.validate(b.code, b.amount, b.kind); }
}

@ApiTags('Notifications')
@Controller('notifications')
class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}
  @Get() @UseGuards(JwtAuthGuard)
  list(@Req() req: any, @Query('userId') userIdOverride?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    const userId = userIdOverride && req.user?.role === 'super_admin' ? userIdOverride : req.user.userId;
    return this.svc.listForUser(userId, +page, +limit);
  }
  @Post('send') send(@Body() b: any) { return this.svc.send(b.userId, b.title, b.body, b.type, b.data); }
  @Post('broadcast') broadcast(@Body() b: any) { return this.svc.broadcast(b.userIds, b.title, b.body); }
  @Post(':id/read') read(@Param('id') id: string) { return this.svc.markRead(id); }
}

@ApiTags('Master Data')
@Controller('master')
class MasterController {
  constructor(private readonly svc: MasterDataService) {}
  @Get('categories') cats() { return this.svc.listCategories(); }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Post('categories') newCat(@Body() b: any) { return this.svc.createCategory(b); }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Delete('categories/:id') delCat(@Param('id') id: string) { return this.svc.deleteCategory(id); }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Get('amenities/all') allAm() { return this.svc.listAmenities(true); }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('gym_owner', 'gym_staff')
  @Get('amenities/my-requests') myAmenityRequests(@Req() req: any) { return this.svc.listAmenityRequestsForUser(req.user?.userId); }
  @Get('amenities') am() { return this.svc.listAmenities(false); }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Post('amenities') newAm(@Body() b: any) { return this.svc.createAmenity(b); }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('gym_owner', 'gym_staff')
  @Post('amenities/request') req(@Body() b: { name: string }, @Req() req: any) { return this.svc.requestAmenityForUser(b.name, req.user?.userId); }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Post('amenities/:id/approve') ap(@Param('id') id: string) { return this.svc.approveAmenity(id); }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Delete('amenities/:id') delAm(@Param('id') id: string) { return this.svc.rejectOrDeleteAmenity(id); }
}

@ApiTags('Videos')
@Controller('videos')
class VideosController {
  constructor(private readonly svc: VideosService) {}
  @Get() list(@Query('category') c?: string) { return this.svc.list(c); }
  @Post() create(@Body() b: any) { return this.svc.create(b); }
}

@ApiTags('Analytics')
@Controller('analytics')
class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}
  @Get('summary') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  summary() { return this.svc.summary(); }
}

// ============ Fraud Detection ============
const SEED_ALERTS = [
  { userId: 'seed-user-001', eventType: 'velocity_check', gymId: 'seed-gym-001', gymName: 'PowerFit Andheri', riskScore: 85, device: 'iPhone 14', details: 'Checked in 4 times within 1 hour', status: 'open' },
  { userId: 'seed-user-002', eventType: 'duplicate_qr', gymId: 'seed-gym-002', gymName: 'FitZone Bandra', riskScore: 92, device: 'Samsung S23', details: 'QR code reused within 60s', status: 'open' },
  { userId: 'seed-user-003', eventType: 'device_mismatch', gymId: 'seed-gym-001', gymName: 'PowerFit Andheri', riskScore: 70, device: 'Pixel 7', details: 'Device fingerprint changed between sessions', status: 'investigating' },
  { userId: 'seed-user-004', eventType: 'velocity_check', gymId: 'seed-gym-003', gymName: 'Iron House Juhu', riskScore: 78, device: 'OnePlus 11', details: 'Checked in 3 times within 45 minutes', status: 'cleared' },
];

@Injectable()
export class FraudService {
  constructor(@InjectRepository(FraudAlertEntity) private readonly repo: Repository<FraudAlertEntity>) {}

  async list(page: any = 1, limit: any = 20, status?: string) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const qb = this.repo.createQueryBuilder('f').orderBy('f.createdAt', 'DESC').skip(skip).take(take);
    if (status) qb.andWhere('f.status = :status', { status });
    const [data, total] = await qb.getManyAndCount();
    return paginatedResponse(data, total, p, l);
  }

  create(data: Partial<FraudAlertEntity>) {
    return this.repo.save(this.repo.create(data));
  }

  async flag(id: string) {
    const alert = await this.repo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    await this.repo.update(id, { status: 'investigating' });
    return this.repo.findOne({ where: { id } });
  }

  async clear(id: string) {
    const alert = await this.repo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    await this.repo.update(id, { status: 'cleared' });
    return this.repo.findOne({ where: { id } });
  }
}

@ApiTags('Fraud')
@Controller('fraud')
class FraudController {
  constructor(private readonly svc: FraudService) {}

  @Get('alerts') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  list(@Query('page') page = 1, @Query('limit') limit = 20, @Query('status') status?: string) {
    return this.svc.list(+page, +limit, status);
  }

  @Post('alerts') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  create(@Body() body: any) { return this.svc.create(body); }

  @Post('alerts/:id/flag') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  flag(@Param('id') id: string) { return this.svc.flag(id); }

  @Post('alerts/:id/clear') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  clear(@Param('id') id: string) { return this.svc.clear(id); }
}

// ============ Homepage Config ============
const HOMEPAGE_CONFIG_KEY = 'homepage_config';

const DEFAULT_HOMEPAGE_CONFIG = {
  _version: 2,
  sections: [
    {
      id: 'hero', type: 'hero', title: 'Hero Banner', visible: true, order: 0,
      slides: [
        {
          imageUrl: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=900&q=80',
          headline: 'Make Every Rep', headlineAccent: 'Count.',
          sub: 'Book day passes at 50+ gyms in Bhubaneswar. No commitment.',
          cta: 'Explore Gyms', ctaRoute: '/gyms',
        },
        {
          imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=900&q=80',
          headline: 'One Pass,', headlineAccent: 'Every Gym.',
          sub: 'The Multi-Gym plan gets you into any partner gym — anytime.',
          cta: 'View Plans', ctaRoute: '/plans',
        },
        {
          imageUrl: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=900&q=80',
          headline: 'Cardio. Strength.', headlineAccent: 'Yoga. All of it.',
          sub: 'Filter by workout type and book the perfect session.',
          cta: 'Find a Gym', ctaRoute: '/gyms?category=all',
        },
        {
          imageUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=900&q=80',
          headline: 'Spa &', headlineAccent: 'Recovery.',
          sub: 'Premium wellness services — massage, physio, and more.',
          cta: 'Explore Wellness', ctaRoute: '/wellness',
        },
      ],
    },
    { id: 'categories', type: 'categories', title: 'Browse by Category', visible: true, order: 1 },
    { id: 'featured_gyms', type: 'featured_gyms', title: 'Featured Gyms', visible: true, order: 2, featuredGymIds: [], gymLimit: 6 },
    { id: 'products', type: 'products', title: 'Shop Fitness Store', visible: true, order: 3, productCategory: null, featuredProductIds: [], productLimit: 5 },
  ],
};

@ApiTags('Homepage')
@Controller('homepage')
class HomepageController {
  constructor(
    @InjectRepository(AppConfigEntity) private readonly configRepo: Repository<AppConfigEntity>,
    @InjectRepository(GymEntity) private readonly gymRepo: Repository<GymEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
  ) {}

  private async loadConfig(): Promise<any> {
    const row = await this.configRepo.findOne({ where: { key: HOMEPAGE_CONFIG_KEY } });
    const value = row?.value as any;
    if (!value?._version || !Array.isArray(value.sections) || value.sections.length === 0) {
      return DEFAULT_HOMEPAGE_CONFIG;
    }
    return value;
  }

  @Get('config')
  async getConfig() {
    const config = await this.loadConfig();
    const resolved = JSON.parse(JSON.stringify(config));

    const sections: any[] = (resolved.sections || []).sort((a: any, b: any) => a.order - b.order);

    for (const section of sections) {
      if (!section.visible) continue;

      if (section.type === 'featured_gyms') {
        if (section.featuredGymIds?.length > 0) {
          section.gyms = await this.gymRepo.find({ where: { id: In(section.featuredGymIds) } });
        } else {
          section.gyms = await this.gymRepo.find({ take: section.gymLimit || 6 });
        }
      }

      if (section.type === 'products') {
        if (section.featuredProductIds?.length > 0) {
          section.products = await this.productRepo.find({ where: { id: In(section.featuredProductIds) } });
        } else {
          const where: any = { isActive: true };
          if (section.productCategory) where.category = section.productCategory;
          section.products = await this.productRepo.find({ where, take: section.productLimit || 5 });
        }
      }
    }

    resolved.sections = sections;
    return resolved;
  }

  @Put('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async saveConfig(@Body() body: any) {
    const value = {
      _version: body?._version || DEFAULT_HOMEPAGE_CONFIG._version,
      sections: Array.isArray(body?.sections) && body.sections.length
        ? body.sections
        : DEFAULT_HOMEPAGE_CONFIG.sections,
    };
    await this.configRepo.save({ key: HOMEPAGE_CONFIG_KEY, value });
    return value;
  }
}

// ============ Admin Settings ============
const ADMIN_SETTINGS_KEY = 'admin_settings';

const DEFAULT_ADMIN_SETTINGS = {
  commission: { standard: 15, premium: 12, corporate: 10 },
  settlements: { cycle: 'Monthly', minPayout: 5000, processingWindow: 7 },
  flags: { storeModule: true, wellnessBooking: true, aiRecommendations: false, corporatePortal: true, mapView: false },
};

@ApiTags('Admin Settings')
@Controller('admin/settings')
class AdminSettingsController {
  constructor(@InjectRepository(AppConfigEntity) private readonly configRepo: Repository<AppConfigEntity>) {}

  private mergeSettings(value: any) {
    return {
      commission: { ...DEFAULT_ADMIN_SETTINGS.commission, ...(value?.commission || {}) },
      settlements: { ...DEFAULT_ADMIN_SETTINGS.settlements, ...(value?.settlements || {}) },
      flags: { ...DEFAULT_ADMIN_SETTINGS.flags, ...(value?.flags || {}) },
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async getSettings() {
    const row = await this.configRepo.findOne({ where: { key: ADMIN_SETTINGS_KEY } });
    return this.mergeSettings(row?.value);
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async saveSettings(@Body() body: any) {
    const value = this.mergeSettings(body);
    await this.configRepo.save({ key: ADMIN_SETTINGS_KEY, value });
    return value;
  }
}

// In-memory commission rate config (no DB migration needed, admin-only)
const DEFAULT_COMMISSION_RATES = [
  { id: '1', planType: 'Individual', commission: 15, minGyms: 1, maxGyms: 1 },
  { id: '2', planType: 'Pro', commission: 13, minGyms: 1, maxGyms: 5 },
  { id: '3', planType: 'Max', commission: 12, minGyms: 1, maxGyms: 999 },
  { id: '4', planType: 'Elite', commission: 10, minGyms: 1, maxGyms: 999 },
  { id: '5', planType: 'Corporate', commission: 8, minGyms: 10, maxGyms: 999 },
];

const COMMISSION_RATES_KEY = 'commission_rates';

@ApiTags('Commission')
@Controller('commission')
class CommissionController {
  constructor(@InjectRepository(AppConfigEntity) private readonly configRepo: Repository<AppConfigEntity>) {}

  private async loadRates() {
    const row = await this.configRepo.findOne({ where: { key: COMMISSION_RATES_KEY } });
    return Array.isArray(row?.value) ? row.value : DEFAULT_COMMISSION_RATES;
  }

  @Get('rates') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  getRates() { return this.loadRates(); }

  @Put('rates/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  async updateRate(@Param('id') id: string, @Body() body: { commission?: number; minGyms?: number; maxGyms?: number }) {
    const rates = await this.loadRates();
    const idx = rates.findIndex((r: any) => r.id === id);
    if (idx === -1) return { error: 'Not found' };
    rates[idx] = { ...rates[idx], ...body };
    await this.configRepo.save({ key: COMMISSION_RATES_KEY, value: rates });
    return rates[idx];
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([
    RatingEntity, CouponEntity, NotificationEntity, CategoryEntity, AmenityEntity, WorkoutVideoEntity,
    CheckinEntity, UserEntity, SubscriptionEntity, GymEntity, FraudAlertEntity,
    AppConfigEntity, ProductEntity,
  ])],
  controllers: [RatingsController, CouponsController, NotificationsController, MasterController, VideosController, AnalyticsController, FraudController, CommissionController, HomepageController, AdminSettingsController],
  providers: [RatingsService, CouponsService, NotificationsService, MasterDataService, VideosService, AnalyticsService, FraudService],
  exports: [RatingsService, CouponsService, NotificationsService, MasterDataService, VideosService, FraudService],
})
export class MiscModule {}
