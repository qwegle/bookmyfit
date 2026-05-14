import { Module, Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Injectable, UseGuards, Req, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate, paginatedResponse } from '../../common/pagination.helper';
import { ApiTags } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional } from 'class-validator';
import { WellnessPartnerEntity, WellnessServiceEntity, WellnessBookingEntity } from '../../database/entities/wellness.entity';
import { CashfreeService } from '../payments/cashfree.service';
import { PaymentsModule } from '../payments/payments.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { v4 as uuid } from 'uuid';

class BookWellnessDto {
  @IsDateString() bookingDate: string;
  @IsOptional() @IsString() phone?: string;
}

@Injectable()
class WellnessService {
  constructor(
    @InjectRepository(WellnessPartnerEntity) private readonly partners: Repository<WellnessPartnerEntity>,
    @InjectRepository(WellnessServiceEntity) private readonly services: Repository<WellnessServiceEntity>,
    @InjectRepository(WellnessBookingEntity) private readonly bookings: Repository<WellnessBookingEntity>,
    private readonly cashfree: CashfreeService,
  ) {}
  async listPartners(filter: { city?: string; serviceType?: string } = {}, page: any = 1, limit: any = 20) {
    const where: any = { status: 'active' };
    if (filter.city) where.city = filter.city;
    if (filter.serviceType) where.serviceType = filter.serviceType;
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const [data, total] = await this.partners.findAndCount({ where, order: { rating: 'DESC' }, skip, take });
    return paginatedResponse(data, total, p, l);
  }
  createPartner(data: Partial<WellnessPartnerEntity>) { return this.partners.save(this.partners.create(data)); }
  async getPartner(id: string) {
    const partner = await this.partners.findOne({ where: { id } });
    if (!partner) throw new NotFoundException('Wellness partner not found');
    return partner;
  }
  updatePartner(id: string, data: Partial<WellnessPartnerEntity>) { return this.partners.save({ id, ...data }); }
  async deletePartner(id: string) {
    await this.partners.update(id, { status: 'inactive' } as any);
    await this.services.update({ partnerId: id } as any, { isActive: false } as any);
    return { success: true };
  }
  private normalizeServiceData(data: any, defaults: Partial<WellnessServiceEntity> = {}) {
    const durationMinutes = Number(data.durationMinutes ?? data.duration ?? defaults.durationMinutes ?? 60);
    const price = Number(data.price ?? defaults.price ?? 0);
    const originalPrice = data.originalPrice === null || data.originalPrice === ''
      ? null
      : data.originalPrice !== undefined
        ? Number(data.originalPrice)
        : defaults.originalPrice;
    return {
      ...defaults,
      ...data,
      durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60,
      price: Number.isFinite(price) ? price : 0,
      originalPrice,
      approvalStatus: data.approvalStatus || defaults.approvalStatus || 'approved',
    };
  }
  listServicesOf(partnerId: string) {
    return this.services.find({ where: { partnerId, isActive: true, approvalStatus: 'approved' } as any });
  }
  createService(data: Partial<WellnessServiceEntity>) {
    const normalized = this.normalizeServiceData(data, { approvalStatus: 'approved', isActive: true } as any);
    return this.services.save(this.services.create(normalized));
  }
  async updateService(id: string, data: Partial<WellnessServiceEntity>) {
    const existing = await this.services.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    return this.services.save({ ...existing, ...this.normalizeServiceData(data, existing) });
  }
  async deleteService(id: string) {
    await this.services.update(id, { isActive: false } as any);
    return { success: true };
  }

  async listAllServices(filter: { category?: string } = {}) {
    const qb = this.services.createQueryBuilder('s')
      .innerJoinAndMapOne('s.partner', WellnessPartnerEntity, 'p', 's."partnerId" = p.id')
      .where('s."isActive" = true')
      .andWhere("s.\"approvalStatus\" = 'approved'")
      .andWhere("p.status = 'active'");
    if (filter.category) qb.andWhere('p."serviceType" = :cat', { cat: filter.category });
    return qb.orderBy('s.price', 'ASC').getMany();
  }

  async listAdminPartners() {
    const [partners] = await this.partners.findAndCount({ order: { createdAt: 'DESC' } });
    const result = await Promise.all(partners.map(async (partner) => {
      const svcs = await this.services.find({ where: { partnerId: partner.id } });
      const active = svcs.filter((s) => s.isActive && (s as any).approvalStatus === 'approved');
      const minPrice = active.length ? Math.min(...active.map(s => Number(s.price))) : null;
      return { ...partner, minPrice, serviceCount: active.length, totalServiceCount: svcs.length };
    }));
    return result;
  }

  listAdminServices() {
    return this.services.createQueryBuilder('s')
      .leftJoinAndMapOne('s.partner', WellnessPartnerEntity, 'p', 's."partnerId" = p.id')
      .orderBy('s.name', 'ASC')
      .getMany();
  }

  async listPartnersWithMinPrice(filter: { city?: string; serviceType?: string } = {}, page: any = 1, limit: any = 20) {
    const where: any = { status: 'active' };
    if (filter.city) where.city = filter.city;
    if (filter.serviceType) where.serviceType = filter.serviceType;
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const [partners, total] = await this.partners.findAndCount({ where, order: { rating: 'DESC' }, skip, take });
    const result = await Promise.all(partners.map(async (partner) => {
      const svcs = await this.services.find({ where: { partnerId: partner.id, isActive: true } });
      const minPrice = svcs.length ? Math.min(...svcs.map(s => Number(s.price))) : null;
      return { ...partner, minPrice, serviceCount: svcs.length };
    }));
    return paginatedResponse(result, total, p, l);
  }

  async book(userId: string, serviceId: string, bookingDate: string, phone: string) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(serviceId)) throw new NotFoundException('Service not found');
    const service = await this.services.findOne({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Service not found');
    const partner = await this.partners.findOne({ where: { id: service.partnerId } });
    const amount = Number(service.price);
    const platformCommission = amount * (Number(partner?.commissionRate || 30) / 100);
    const orderId = `WL_${uuid().slice(0, 18)}`;
    const booking = await this.bookings.save(this.bookings.create({
      userId, partnerId: service.partnerId, serviceId,
      bookingDate: new Date(bookingDate), amount, platformCommission,
      status: 'pending', cashfreeOrderId: orderId,
    }));
    const payment = await this.cashfree.createOrder({
      orderId, amount, customerId: userId, customerPhone: phone,
      notes: { kind: 'wellness', bookingId: booking.id },
    });
    return { booking, payment };
  }

  async myBookings(userId: string) {
    const bks = await this.bookings.find({ where: { userId }, order: { bookingDate: 'DESC' } });
    return Promise.all(bks.map(async (b) => {
      const service = b.serviceId ? await this.services.findOne({ where: { id: b.serviceId } }) : null;
      const partner = b.partnerId ? await this.partners.findOne({ where: { id: b.partnerId } }) : null;
      return {
        id: b.id, status: b.status, bookingDate: b.bookingDate, amount: b.amount,
        cashfreeOrderId: b.cashfreeOrderId, invoiceNumber: (b as any).invoiceNumber,
        service: service ? { id: service.id, name: service.name, durationMinutes: service.durationMinutes, imageUrl: service.imageUrl } : null,
        partner: partner ? { id: partner.id, name: partner.name, serviceType: partner.serviceType, city: partner.city, area: partner.area, photos: partner.photos } : null,
      };
    }));
  }

  async confirmBooking(bookingId: string) {
    const b = await this.bookings.findOne({ where: { id: bookingId } });
    if (!b) throw new Error('Booking not found');
    b.status = 'confirmed';
    await this.bookings.save(b);
    return b;
  }

  /** Bookings for a specific partner (used by wellness portal) */
  async partnerBookings(partnerId: string) {
    const bks = await this.bookings.find({ where: { partnerId }, order: { bookingDate: 'DESC' } });
    return Promise.all(bks.map(async (b) => {
      const service = b.serviceId ? await this.services.findOne({ where: { id: b.serviceId } }) : null;
      return { ...b, serviceName: service?.name, scheduledAt: b.bookingDate };
    }));
  }

  async updateBookingStatus(partnerId: string, bookingId: string, status: string) {
    const b = await this.bookings.findOne({ where: { id: bookingId, partnerId } });
    if (!b) throw new Error('Booking not found');
    await this.bookings.update(bookingId, { status } as any);
    return { ...b, status };
  }

  /** Services scoped to a partner (used by wellness portal) */
  partnerServices(partnerId: string) { return this.services.find({ where: { partnerId } }); }

  async createPartnerService(partnerId: string, data: Partial<WellnessServiceEntity>) {
    const normalized = this.normalizeServiceData(data, {
      partnerId,
      isActive: false,
      approvalStatus: 'pending',
    } as any);
    return this.services.save(this.services.create(normalized));
  }

  async updatePartnerService(partnerId: string, serviceId: string, data: Partial<WellnessServiceEntity>) {
    const svc = await this.services.findOne({ where: { id: serviceId, partnerId } });
    if (!svc) throw new Error('Service not found');
    const normalized = this.normalizeServiceData(data, {
      ...svc,
      isActive: false,
      approvalStatus: 'pending',
      reviewNote: null,
    } as any);
    return this.services.save({ ...svc, ...normalized, partnerId });
  }

  async deletePartnerService(partnerId: string, serviceId: string) {
    const svc = await this.services.findOne({ where: { id: serviceId, partnerId } });
    if (!svc) throw new Error('Service not found');
    await this.services.update(serviceId, { isActive: false } as any);
    return { success: true };
  }

  /** Earnings summary for wellness partner dashboard */
  async partnerEarnings(partnerId: string) {
    const bks = await this.bookings.find({ where: { partnerId }, order: { bookingDate: 'DESC' } });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const completed = bks.filter(b => b.status === 'completed' || b.status === 'confirmed');
    const thisMonth = completed.filter(b => new Date(b.bookingDate) >= monthStart);
    const lastMonth = completed.filter(b => {
      const d = new Date(b.bookingDate);
      return d >= lastMonthStart && d < monthStart;
    });

    const totalRevenue = completed.reduce((s, b) => s + Number(b.amount || 0), 0);
    const totalCommission = completed.reduce((s, b) => s + Number(b.platformCommission || 0), 0);
    const netEarnings = totalRevenue - totalCommission;

    const thisMonthRevenue = thisMonth.reduce((s, b) => s + Number(b.amount || 0), 0);
    const thisMonthNet = thisMonth.reduce((s, b) => s + Number(b.amount || 0) - Number(b.platformCommission || 0), 0);
    const lastMonthNet = lastMonth.reduce((s, b) => s + Number(b.amount || 0) - Number(b.platformCommission || 0), 0);

    // Monthly breakdown (last 6 months)
    const monthly: Record<string, { month: string; revenue: number; commission: number; net: number; bookings: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = { month: key, revenue: 0, commission: 0, net: 0, bookings: 0 };
    }
    completed.forEach(b => {
      const d = new Date(b.bookingDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthly[key]) {
        monthly[key].revenue += Number(b.amount || 0);
        monthly[key].commission += Number(b.platformCommission || 0);
        monthly[key].net += Number(b.amount || 0) - Number(b.platformCommission || 0);
        monthly[key].bookings += 1;
      }
    });

    return {
      summary: {
        totalRevenue, totalCommission, netEarnings,
        thisMonthRevenue, thisMonthNet, lastMonthNet,
        totalBookings: bks.length, completedBookings: completed.length,
      },
      monthly: Object.values(monthly),
      recentBookings: bks.slice(0, 10).map(b => ({
        id: b.id, status: b.status, bookingDate: b.bookingDate,
        amount: b.amount, platformCommission: b.platformCommission,
        net: Number(b.amount || 0) - Number(b.platformCommission || 0),
      })),
    };
  }

  async getBookingInvoice(bookingId: string, userId: string) {
    const b = await this.bookings.findOne({ where: { id: bookingId, userId } });
    if (!b) throw new Error('Booking not found');
    const service = b.serviceId ? await this.services.findOne({ where: { id: b.serviceId } }) : null;
    const partner = b.partnerId ? await this.partners.findOne({ where: { id: b.partnerId } }) : null;
    if (!(b as any).invoiceNumber) {
      const seq = Math.floor(Date.now() / 1000) % 100000;
      const d = new Date();
      (b as any).invoiceNumber = `BMF-WL-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${seq}`;
      await this.bookings.save(b);
    }
    return {
      invoiceNumber: (b as any).invoiceNumber, bookingDate: b.bookingDate,
      amount: b.amount, status: b.status, cashfreeOrderId: b.cashfreeOrderId,
      service: service ? { name: service.name, durationMinutes: service.durationMinutes } : null,
      partner: partner ? { name: partner.name, address: partner.address, city: partner.city } : null,
      issuedAt: new Date(),
    };
  }
}

@ApiTags('Wellness')
@Controller('wellness')
class WellnessController {
  constructor(private readonly svc: WellnessService) {}

  private async assertPartnerAccess(partnerId: string, req: any) {
    if (req.user?.role !== 'wellness_partner') return;
    const partner = await this.svc.getPartner(partnerId);
    if (partner.ownerId !== req.user.userId) throw new ForbiddenException('Cannot access another wellness partner');
  }

  @Get('partners')
  partners(
    @Query('city') city?: string,
    @Query('serviceType') type?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.listPartnersWithMinPrice({ city, serviceType: type }, +page, +limit);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Get('admin/partners')
  adminPartners() {
    return this.svc.listAdminPartners();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Get('admin/services')
  adminServices() {
    return this.svc.listAdminServices();
  }

  @Get('partners/:id')
  getPartner(@Param('id') id: string) { return this.svc.getPartner(id); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Post('partners')
  createPartner(@Body() b: any) { return this.svc.createPartner(b); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'wellness_partner')
  @Put('partners/:id')
  async updatePartner(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    if (req.user.role === 'wellness_partner') {
      const partner = await this.svc.getPartner(id);
      if (partner.ownerId !== req.user.userId) throw new ForbiddenException('Cannot update another wellness partner');
    }
    return this.svc.updatePartner(id, b);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Delete('partners/:id')
  deletePartner(@Param('id') id: string) { return this.svc.deletePartner(id); }

  @Get('services/all')
  allServices(@Query('category') cat?: string) {
    return this.svc.listAllServices({ category: cat });
  }

  @Get('partners/:id/services')
  services(@Param('id') id: string) { return this.svc.listServicesOf(id); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Post('services')
  createService(@Body() b: any) { return this.svc.createService(b); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Put('services/:id')
  updateService(@Param('id') id: string, @Body() b: any) { return this.svc.updateService(id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Delete('services/:id')
  deleteService(@Param('id') id: string) { return this.svc.deleteService(id); }

  @UseGuards(JwtAuthGuard)
  @Post('services/:id/book')
  book(@Param('id') id: string, @Body() b: BookWellnessDto, @Req() req: any) {
    return this.svc.book(req.user.userId, id, b.bookingDate, b.phone || req.user.phone || '');
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookings/my')
  myBookings(@Req() req: any) {
    return this.svc.myBookings(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings/:id/confirm')
  confirmBooking(@Param('id') id: string) {
    return this.svc.confirmBooking(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookings/:id/invoice')
  getInvoice(@Param('id') id: string, @Req() req: any) {
    return this.svc.getBookingInvoice(id, req.user.userId);
  }

  // ─── Partner-scoped routes (used by wellness portal frontend) ─────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'wellness_partner')
  @Get(':partnerId/bookings')
  async partnerBookings(@Param('partnerId') partnerId: string, @Req() req: any) {
    await this.assertPartnerAccess(partnerId, req);
    return this.svc.partnerBookings(partnerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'wellness_partner')
  @Patch(':partnerId/bookings/:id')
  async updateBooking(@Param('partnerId') partnerId: string, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.assertPartnerAccess(partnerId, req);
    return this.svc.updateBookingStatus(partnerId, id, body.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'wellness_partner')
  @Get(':partnerId/services')
  async partnerServices(@Param('partnerId') partnerId: string, @Req() req: any) {
    await this.assertPartnerAccess(partnerId, req);
    return this.svc.partnerServices(partnerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'wellness_partner')
  @Post(':partnerId/services')
  async createPartnerService(@Param('partnerId') partnerId: string, @Body() body: any, @Req() req: any) {
    await this.assertPartnerAccess(partnerId, req);
    return this.svc.createPartnerService(partnerId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'wellness_partner')
  @Put(':partnerId/services/:id')
  async updatePartnerService(@Param('partnerId') partnerId: string, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.assertPartnerAccess(partnerId, req);
    return this.svc.updatePartnerService(partnerId, id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'wellness_partner')
  @Delete(':partnerId/services/:id')
  async deletePartnerService(@Param('partnerId') partnerId: string, @Param('id') id: string, @Req() req: any) {
    await this.assertPartnerAccess(partnerId, req);
    return this.svc.deletePartnerService(partnerId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'wellness_partner')
  @Get(':partnerId/earnings')
  async partnerEarnings(@Param('partnerId') partnerId: string, @Req() req: any) {
    await this.assertPartnerAccess(partnerId, req);
    return this.svc.partnerEarnings(partnerId);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([WellnessPartnerEntity, WellnessServiceEntity, WellnessBookingEntity]), PaymentsModule],
  controllers: [WellnessController],
  providers: [WellnessService],
})
export class WellnessModule {}
