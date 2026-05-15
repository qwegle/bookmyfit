import {
  Module, Controller, Get, Post, Delete, Param, Body, Query,
  Injectable, UseGuards, Req, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Repository, IsNull } from 'typeorm';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { GymSlotEntity } from '../../database/entities/gym-slot.entity';
import { SlotBookingEntity } from '../../database/entities/slot-booking.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { BookingQrEntity } from '../../database/entities/booking-qr.entity';
import { GymEntity } from '../../database/entities/gym.entity';
import { GymScheduleEntity } from '../../database/entities/gym-schedule.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';

const BOOKING_QR_EXPIRY_HOURS = 2;

function isPastDateOnly(endDate: string | Date) {
  const iso = endDate instanceof Date ? endDate.toISOString().slice(0, 10) : String(endDate).slice(0, 10);
  return iso < new Date().toISOString().slice(0, 10);
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function overlapsWindow(start: string, end: string, windowStart?: string | null, windowEnd?: string | null): boolean {
  if (!windowStart || !windowEnd) return false;
  return minutesOf(start) < minutesOf(windowEnd) && minutesOf(end) > minutesOf(windowStart);
}

function dayOfWeekFromDate(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00Z');
  return (d.getUTCDay() + 6) % 7;
}

@Injectable()
class SlotsService {
  constructor(
    @InjectRepository(GymSlotEntity) private readonly slotRepo: Repository<GymSlotEntity>,
    @InjectRepository(SlotBookingEntity) private readonly bookingRepo: Repository<SlotBookingEntity>,
    @InjectRepository(SubscriptionEntity) private readonly subRepo: Repository<SubscriptionEntity>,
    @InjectRepository(BookingQrEntity) private readonly qrRepo: Repository<BookingQrEntity>,
    @InjectRepository(GymEntity) private readonly gymRepo: Repository<GymEntity>,
    @InjectRepository(GymScheduleEntity) private readonly scheduleRepo: Repository<GymScheduleEntity>,
    private readonly jwt: JwtService,
  ) {}

  async listSlots(gymId: string, date: string) {
    const [slots, schedule] = await Promise.all([
      this.slotRepo.find({ where: { gymId, date }, order: { startTime: 'ASC' } }),
      this.scheduleRepo.findOne({ where: { gymId, dayOfWeek: dayOfWeekFromDate(date) } }),
    ]);
    return slots.filter((slot) => !overlapsWindow(slot.startTime, slot.endTime, schedule?.breakStartTime, schedule?.breakEndTime));
  }

  createSlot(data: { gymId: string; date: string; startTime: string; endTime: string; capacity?: number }) {
    return this.slotRepo.save(this.slotRepo.create(data));
  }

  async bookSlot(slotId: string, userId: string, subscriptionId?: string) {
    if (!isUuid(slotId)) throw new NotFoundException('Slot not found');
    const slot = await this.slotRepo.findOne({ where: { id: slotId } });
    if (!slot) throw new NotFoundException('Slot not found');
    const schedule = await this.scheduleRepo.findOne({ where: { gymId: slot.gymId, dayOfWeek: dayOfWeekFromDate(slot.date) } });
    if (overlapsWindow(slot.startTime, slot.endTime, schedule?.breakStartTime, schedule?.breakEndTime)) {
      throw new BadRequestException('This gym is on break during the selected time. Please choose another slot.');
    }
    if (slot.booked >= slot.capacity) throw new BadRequestException('Slot is full');

    const existing = await this.bookingRepo.findOne({ where: { slotId, userId, status: 'confirmed' } });
    if (existing) throw new BadRequestException('Already booked this slot');

    // Find an active subscription that covers this slot's gym.
    const sub = subscriptionId
      ? await this.subRepo.findOne({ where: { id: subscriptionId, userId } })
      : await this.subRepo.createQueryBuilder('sub')
        .where('sub."userId" = :userId', { userId })
        .andWhere('sub.status = :status', { status: 'active' })
        .andWhere('sub."endDate" >= CURRENT_DATE')
        .andWhere('(sub."planType" = :multiGym OR :gymId = ANY(sub."gymIds"))', { multiGym: 'multi_gym', gymId: slot.gymId })
        .orderBy(`CASE WHEN :gymId = ANY(sub."gymIds") THEN 0 ELSE 1 END`, 'ASC')
        .addOrderBy('sub."createdAt"', 'DESC')
        .getOne();
    if (!sub) throw new BadRequestException('No active subscription found. Please subscribe first.');
    if (sub.status !== 'active' || isPastDateOnly(sub.endDate)) {
      throw new BadRequestException('No active subscription found. Please subscribe first.');
    }

    const coveredGyms = sub.gymIds || [];
    if (sub.planType === 'same_gym' && !coveredGyms.includes(slot.gymId)) {
      throw new BadRequestException('Your Same Gym Pass is only valid for the gym you subscribed to.');
    }
    if (sub.planType === 'day_pass' && coveredGyms.length > 0 && !coveredGyms.includes(slot.gymId)) {
      throw new BadRequestException('Your 1-Day Pass is for a different gym.');
    }

    // Session lock: same_gym and multi_gym users may only have 1 active booking at a time
    if (sub.planType !== 'day_pass') {
      const now = new Date();
      const activeQr = await this.qrRepo.findOne({
        where: { userId, usedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
      if (activeQr && new Date(activeQr.expiresAt) > now) {
        throw new ConflictException(
          'You already have an active gym session. Please use your current QR code or wait for it to expire before booking again.',
        );
      }
    }

    // Create the slot booking
    slot.booked += 1;
    if (slot.booked >= slot.capacity) slot.status = 'full';
    await this.slotRepo.save(slot);

    const booking = await this.bookingRepo.save(
      this.bookingRepo.create({ slotId, userId, gymId: slot.gymId }),
    );

    // Generate 2-hour booking QR
    const jti = uuidv4();
    const bookedAt = new Date();
    const expiresAt = new Date(bookedAt.getTime() + BOOKING_QR_EXPIRY_HOURS * 60 * 60 * 1000);

    const qrPayload = {
      sub: userId,
      gym: slot.gymId,
      sid: sub.id,
      bid: booking.id,
      jti,
      type: 'booking',
    };
    const qrToken = this.jwt.sign(qrPayload, { expiresIn: `${BOOKING_QR_EXPIRY_HOURS}h` });

    const bookingQr = await this.qrRepo.save(
      this.qrRepo.create({ userId, gymId: slot.gymId, subscriptionId: sub.id, slotBookingId: booking.id, qrToken, expiresAt, bookedAt }),
    );

    const gym = await this.gymRepo.findOne({ where: { id: slot.gymId } });

    return {
      ...booking,
      slot,
      bookingQr: {
        id: bookingQr.id,
        token: qrToken,
        expiresAt: expiresAt.toISOString(),
        bookedAt: bookedAt.toISOString(),
        gymId: slot.gymId,
        gymName: gym?.name ?? '',
        bookingId: booking.id,
        manualCode: booking.id,
      },
    };
  }

  async cancelBooking(slotId: string, userId: string) {
    const booking = await this.bookingRepo.findOne({ where: { slotId, userId, status: 'confirmed' } });
    if (!booking) throw new NotFoundException('Booking not found');
    booking.status = 'cancelled';
    await this.bookingRepo.save(booking);
    const slot = await this.slotRepo.findOne({ where: { id: slotId } });
    if (slot && slot.booked > 0) {
      slot.booked -= 1;
      if (slot.status === 'full') slot.status = 'active';
      await this.slotRepo.save(slot);
    }
    return { success: true };
  }

  myBookings(userId: string) {
    return this.bookingRepo.find({
      where: { userId, status: 'confirmed' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /** Returns the user's currently active booking QR (not expired, not used), or null */
  async getActiveBooking(userId: string) {
    const now = new Date();
    const qrs = await this.qrRepo.find({
      where: { userId, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    const active = qrs.find(q => new Date(q.expiresAt) > now);
    if (!active) return { active: false };
    const gym = await this.gymRepo.findOne({ where: { id: active.gymId } });
    const booking = active.slotBookingId
      ? await this.bookingRepo.findOne({ where: { id: active.slotBookingId } })
      : null;
    return {
      active: true,
      bookingQr: {
        id: active.id,
        token: active.qrToken,
        expiresAt: active.expiresAt.toISOString(),
        bookedAt: active.bookedAt ? active.bookedAt.toISOString() : active.createdAt.toISOString(),
        gymId: active.gymId,
        gymName: gym?.name ?? '',
        bookingId: active.slotBookingId,
        bookingRef: (booking as any)?.bookingRef || null,
        manualCode: (booking as any)?.bookingRef || active.slotBookingId,
      },
    };
  }
}

@ApiTags('Slots')
@Controller('slots')
class SlotsController {
  constructor(private readonly svc: SlotsService) {}

  @Get('my-bookings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  myBookings(@Req() req: any) { return this.svc.myBookings(req.user.userId); }

  @Get('active-booking')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  activeBooking(@Req() req: any) { return this.svc.getActiveBooking(req.user.userId); }

  @Get()
  listSlots(@Query('gymId') gymId: string, @Query('date') date: string) {
    return this.svc.listSlots(gymId, date);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'gym_owner', 'gym_staff')
  createSlot(@Body() body: { gymId: string; date: string; startTime: string; endTime: string; capacity?: number }) {
    return this.svc.createSlot(body);
  }

  @Post(':id/book')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  bookSlot(@Param('id') id: string, @Req() req: any, @Body() body: { subscriptionId?: string }) {
    return this.svc.bookSlot(id, req.user.userId, body?.subscriptionId);
  }

  @Delete(':id/book')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cancelBooking(@Param('id') id: string, @Req() req: any) {
    return this.svc.cancelBooking(id, req.user.userId);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([GymSlotEntity, SlotBookingEntity, SubscriptionEntity, BookingQrEntity, GymEntity, GymScheduleEntity]),
    JwtModule.register({
      secret: process.env.QR_SECRET || 'qr-hmac-secret-change-me',
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [SlotsController],
  providers: [SlotsService],
  exports: [SlotsService],
})
export class SlotsModule {}
