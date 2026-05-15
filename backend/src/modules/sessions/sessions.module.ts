import {
  Module, Controller, Get, Post, Put, Delete, Param, Body, Query,
  Injectable, UseGuards, Req, NotFoundException, BadRequestException,
  ConflictException, ForbiddenException, Logger,
} from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional, IsArray, Min, Max, Length } from 'class-validator';

import { GymScheduleEntity } from '../../database/entities/gym-schedule.entity';
import { SessionTypeEntity } from '../../database/entities/session-type.entity';
import { SessionScheduleEntity } from '../../database/entities/session-schedule.entity';
import { SessionSlotEntity } from '../../database/entities/session-slot.entity';
import { SessionBookingEntity } from '../../database/entities/session-booking.entity';
import { AttendanceEntity } from '../../database/entities/attendance.entity';
import { GymEntity } from '../../database/entities/gym.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { CheckinEntity } from '../../database/entities/checkin.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { BookingQrEntity } from '../../database/entities/booking-qr.entity';
import { v4 as uuidv4 } from 'uuid';
import { paginate, paginatedResponse } from '../../common/pagination.helper';

// ─── DTOs ────────────────────────────────────────────────────────────────────

class SetScheduleDayDto {
  @IsNumber() @Min(0) @Max(6) dayOfWeek: number;
  @IsBoolean() isOpen: boolean;
  @IsString() @Length(5, 5) openTime: string;
  @IsString() @Length(5, 5) closeTime: string;
  @IsOptional() @IsString() @Length(5, 5) breakStartTime?: string | null;
  @IsOptional() @IsString() @Length(5, 5) breakEndTime?: string | null;
}

class UpsertScheduleDto {
  @IsArray() days: SetScheduleDayDto[];
}

class CreateSessionTypeDto {
  @IsString() @Length(1, 100) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(15) durationMinutes?: number;
  @IsOptional() @IsNumber() @Min(1) maxCapacity?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() instructor?: string;
}

class UpdateSessionTypeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(15) durationMinutes?: number;
  @IsOptional() @IsNumber() @Min(1) maxCapacity?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() instructor?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpsertSessionScheduleDto {
  @IsString() sessionTypeId: string;
  @IsArray() daysOfWeek: number[];
  @IsString() @Length(5, 5) startTime: string;
  @IsString() @Length(5, 5) endTime: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validUntil?: string;
}

class BookSlotDto {
  @IsString() slotId: string;
  @IsOptional() @IsString() subscriptionId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomRef(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split('T')[0];
}

function nowTimeIST(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function overlapsWindow(start: string, end: string, windowStart?: string | null, windowEnd?: string | null): boolean {
  if (!windowStart || !windowEnd) return false;
  return minutesOf(start) < minutesOf(windowEnd) && minutesOf(end) > minutesOf(windowStart);
}

function hourlySlots(openTime: string, closeTime: string, durationMins: number, breakStartTime?: string | null, breakEndTime?: string | null): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = [];
  const openMins = minutesOf(openTime);
  const closeMins = minutesOf(closeTime);
  for (let m = openMins; m + durationMins <= closeMins; m += durationMins) {
    const sh = Math.floor(m / 60);
    const sm = m % 60;
    const em = m + durationMins;
    const eh = Math.floor(em / 60);
    const emm = em % 60;
    const start = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
    const end = `${String(eh).padStart(2, '0')}:${String(emm).padStart(2, '0')}`;
    if (!overlapsWindow(start, end, breakStartTime, breakEndTime)) slots.push({ start, end });
  }
  return slots;
}

function dayOfWeekFromDate(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00Z');
  return (d.getUTCDay() + 6) % 7; // 0=Mon…6=Sun
}

// ─── Service ─────────────────────────────────────────────────────────────────

function dateTimeInIST(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+05:30`);
}

function bookingQrExpiryForSlot(slot: { date: string; endTime: string }) {
  const expiresAt = dateTimeInIST(slot.date, slot.endTime);
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);
  return expiresAt;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger('SessionsService');

  constructor(
    @InjectRepository(GymScheduleEntity) private readonly scheduleRepo: Repository<GymScheduleEntity>,
    @InjectRepository(SessionTypeEntity) private readonly typeRepo: Repository<SessionTypeEntity>,
    @InjectRepository(SessionScheduleEntity) private readonly ruleRepo: Repository<SessionScheduleEntity>,
    @InjectRepository(SessionSlotEntity) private readonly slotRepo: Repository<SessionSlotEntity>,
    @InjectRepository(SessionBookingEntity) private readonly bookingRepo: Repository<SessionBookingEntity>,
    @InjectRepository(AttendanceEntity) private readonly attendanceRepo: Repository<AttendanceEntity>,
    @InjectRepository(GymEntity) private readonly gymRepo: Repository<GymEntity>,
    @InjectRepository(SubscriptionEntity) private readonly subRepo: Repository<SubscriptionEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CheckinEntity) private readonly checkinRepo: Repository<CheckinEntity>,
    @InjectRepository(BookingQrEntity) private readonly qrRepo: Repository<BookingQrEntity>,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
  ) {}

  // ── Operating Hours ──────────────────────────────────────────────────────

  async getSchedule(gymId: string) {
    const rows = await this.scheduleRepo.find({ where: { gymId }, order: { dayOfWeek: 'ASC' } });
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return DAYS.map((label, i) => {
      const row = rows.find((r) => r.dayOfWeek === i);
      return { label, ...(row ?? { gymId, dayOfWeek: i, isOpen: i < 6, openTime: '06:00', closeTime: '22:00', breakStartTime: null, breakEndTime: null }) };
    });
  }

  private validateScheduleDay(day: SetScheduleDayDto) {
    if (day.openTime >= day.closeTime) throw new BadRequestException(`${day.dayOfWeek}: closing time must be after opening time`);
    const hasBreakStart = !!day.breakStartTime;
    const hasBreakEnd = !!day.breakEndTime;
    if (hasBreakStart !== hasBreakEnd) throw new BadRequestException(`${day.dayOfWeek}: both break start and break end are required`);
    if (day.breakStartTime && day.breakEndTime) {
      if (day.breakStartTime >= day.breakEndTime) throw new BadRequestException(`${day.dayOfWeek}: break end must be after break start`);
      if (day.breakStartTime < day.openTime || day.breakEndTime > day.closeTime) {
        throw new BadRequestException(`${day.dayOfWeek}: break time must be inside opening hours`);
      }
    }
  }

  async upsertSchedule(gymId: string, dto: UpsertScheduleDto) {
    for (const day of dto.days) {
      this.validateScheduleDay(day);
      const existing = await this.scheduleRepo.findOne({ where: { gymId, dayOfWeek: day.dayOfWeek } });
      const patch = {
        isOpen: day.isOpen,
        openTime: day.openTime,
        closeTime: day.closeTime,
        breakStartTime: day.breakStartTime || null,
        breakEndTime: day.breakEndTime || null,
      };
      if (existing) {
        Object.assign(existing, patch);
        await this.scheduleRepo.save(existing);
      } else {
        await this.scheduleRepo.save(this.scheduleRepo.create({ gymId, dayOfWeek: day.dayOfWeek, ...patch }));
      }
    }
    const firstOpen = dto.days.find((day) => day.isOpen) || dto.days[0];
    if (firstOpen) {
      await this.gymRepo.update(gymId, {
        openingTime: firstOpen.openTime,
        closingTime: firstOpen.closeTime,
        breakStartTime: firstOpen.breakStartTime || null,
        breakEndTime: firstOpen.breakEndTime || null,
      });
    }
    await this.removeFutureStandardSlotsBlockedBySchedule(gymId);
    await this.generateSlotsForGym(gymId, 30);
    return this.getSchedule(gymId);
  }

  private async removeFutureStandardSlotsBlockedBySchedule(gymId: string) {
    const today = todayIST();
    const [schedules, stdType] = await Promise.all([
      this.scheduleRepo.find({ where: { gymId } }),
      this.ensureGymWorkout(gymId),
    ]);
    const futureSlots = await this.slotRepo.createQueryBuilder('s')
      .where('s."gymId" = :gymId', { gymId })
      .andWhere('s."sessionTypeId" = :typeId', { typeId: stdType.id })
      .andWhere('s.date >= :today', { today })
      .andWhere('s."bookedCount" = 0')
      .getMany();
    for (const slot of futureSlots) {
      const schedule = schedules.find((s) => s.dayOfWeek === dayOfWeekFromDate(slot.date));
      const blocked = !schedule?.isOpen
        || slot.startTime < (schedule?.openTime ?? '06:00')
        || slot.endTime > (schedule?.closeTime ?? '22:00')
        || overlapsWindow(slot.startTime, slot.endTime, schedule?.breakStartTime, schedule?.breakEndTime);
      if (blocked) await this.slotRepo.remove(slot);
    }
  }

  // ── Session Types ────────────────────────────────────────────────────────

  async getSessionTypes(gymId: string) {
    return this.typeRepo.find({ where: { gymId }, order: { kind: 'ASC', createdAt: 'ASC' } });
  }

  async ensureGymWorkout(gymId: string): Promise<SessionTypeEntity> {
    const existing = await this.typeRepo.findOne({ where: { gymId, kind: 'standard' } });
    if (existing) return existing;
    return this.typeRepo.save(
      this.typeRepo.create({
        gymId, name: 'Gym Workout', kind: 'standard',
        description: 'Open gym access — available every hour during operating hours.',
        durationMinutes: 60, maxCapacity: 30, color: '#3DFF54', isActive: true,
      }),
    );
  }

  async createSessionType(gymId: string, dto: CreateSessionTypeDto): Promise<SessionTypeEntity> {
    return this.typeRepo.save(
      this.typeRepo.create({
        gymId, name: dto.name, kind: 'special',
        description: dto.description,
        durationMinutes: dto.durationMinutes ?? 60,
        maxCapacity: dto.maxCapacity ?? 20,
        color: dto.color ?? '#6C63FF',
        instructor: dto.instructor,
        isActive: true,
      }),
    );
  }

  async updateSessionType(gymId: string, id: string, dto: UpdateSessionTypeDto) {
    const type = await this.typeRepo.findOne({ where: { id, gymId } });
    if (!type) throw new NotFoundException('Session type not found');
    Object.assign(type, dto);
    return this.typeRepo.save(type);
  }

  async deleteSessionType(gymId: string, id: string) {
    const type = await this.typeRepo.findOne({ where: { id, gymId } });
    if (!type) throw new NotFoundException('Session type not found');
    if (type.kind === 'standard') throw new ForbiddenException('Cannot delete the standard Gym Workout type');
    await this.typeRepo.remove(type);
    return { success: true };
  }

  // ── Session Schedules (Recurring Rules) ──────────────────────────────────

  async getSessionSchedules(gymId: string) {
    const rules = await this.ruleRepo.find({ where: { gymId }, order: { createdAt: 'ASC' } });
    const types = await this.typeRepo.find({ where: { gymId } });
    return rules.map((r) => ({ ...r, sessionType: types.find((t) => t.id === r.sessionTypeId) }));
  }

  async upsertSessionSchedule(gymId: string, dto: UpsertSessionScheduleDto) {
    const type = await this.typeRepo.findOne({ where: { id: dto.sessionTypeId, gymId } });
    if (!type) throw new NotFoundException('Session type not found');
    let rule = await this.ruleRepo.findOne({ where: { sessionTypeId: dto.sessionTypeId, gymId } });
    if (rule) {
      Object.assign(rule, {
        daysOfWeek: dto.daysOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isActive: dto.isActive ?? rule.isActive,
        validFrom: dto.validFrom ?? rule.validFrom,
        validUntil: dto.validUntil ?? rule.validUntil,
      });
    } else {
      rule = this.ruleRepo.create({ ...dto, gymId }) as any;
    }
    const saved = await this.ruleRepo.save(rule as any);
    await this.generateSlotsForGym(gymId, 30);
    return saved;
  }

  async deleteSessionSchedule(gymId: string, id: string) {
    const rule = await this.ruleRepo.findOne({ where: { id, gymId } });
    if (!rule) throw new NotFoundException('Schedule not found');
    await this.ruleRepo.remove(rule);
    return { success: true };
  }

  // ── Slot Generation ──────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async nightlySlotGeneration() {
    this.logger.log('🕛 Nightly slot generation started');
    const gyms = await this.gymRepo.find({ where: { status: 'active' } });
    for (const gym of gyms) {
      try { await this.generateSlotsForGym(gym.id, 30); } catch (e: any) {
        this.logger.error(`Failed for gym ${gym.id}: ${e.message}`);
      }
    }
    this.logger.log(`✅ Slot generation done for ${gyms.length} gyms`);
  }

  async generateSlotsForGym(gymId: string, daysAhead: number) {
    const today = todayIST();
    const scheduleRows = await this.scheduleRepo.find({ where: { gymId } });
    if (scheduleRows.length === 0) {
      return { generated: 0, reason: 'schedule_not_configured' };
    }
    const types = await this.typeRepo.find({ where: { gymId, isActive: true } });
    const rules = await this.ruleRepo.find({ where: { gymId, isActive: true } });
    const stdType = await this.ensureGymWorkout(gymId);
    if (!types.find((t) => t.id === stdType.id)) types.push(stdType);

    const slotsToCreate: Array<Partial<SessionSlotEntity>> = [];

    for (let d = 0; d < daysAhead; d++) {
      const dateStr = addDays(today, d);
      const dow = dayOfWeekFromDate(dateStr);
      const dayRow = scheduleRows.find((s) => s.dayOfWeek === dow);
      if (dayRow && !dayRow.isOpen) continue;

      const openTime = dayRow?.openTime ?? '06:00';
      const closeTime = dayRow?.closeTime ?? '22:00';

      for (const type of types) {
        if (type.kind === 'standard') {
          const slotTimes = hourlySlots(openTime, closeTime, type.durationMinutes, dayRow?.breakStartTime, dayRow?.breakEndTime);
          for (const st of slotTimes) {
            const exists = await this.slotRepo.findOne({
              where: { gymId, sessionTypeId: type.id, date: dateStr, startTime: st.start },
            });
            if (!exists) {
              slotsToCreate.push({
                gymId, sessionTypeId: type.id, date: dateStr,
                startTime: st.start, endTime: st.end,
                maxCapacity: type.maxCapacity, bookedCount: 0, status: 'scheduled',
              });
            }
          }
        } else {
          const rule = rules.find((r) => r.sessionTypeId === type.id);
          if (!rule) continue;
          const ruleDays = Array.isArray(rule.daysOfWeek)
            ? rule.daysOfWeek.map(Number)
            : String(rule.daysOfWeek).split(',').map(Number);
          if (!ruleDays.includes(dow)) continue;
          if (rule.validFrom && dateStr < rule.validFrom) continue;
          if (rule.validUntil && dateStr > rule.validUntil) continue;
          const exists = await this.slotRepo.findOne({
            where: { gymId, sessionTypeId: type.id, date: dateStr, startTime: rule.startTime },
          });
          if (!exists) {
            slotsToCreate.push({
              gymId, sessionTypeId: type.id, date: dateStr,
              startTime: rule.startTime, endTime: rule.endTime,
              maxCapacity: type.maxCapacity, bookedCount: 0, status: 'scheduled',
            });
          }
        }
      }
    }

    if (slotsToCreate.length > 0) {
      for (const s of slotsToCreate) {
        await this.slotRepo.save(this.slotRepo.create(s as any));
      }
      this.logger.log(`Generated ${slotsToCreate.length} slots for gym ${gymId}`);
    }
    return { generated: slotsToCreate.length };
  }

  // ── Customer: Browse & Book ──────────────────────────────────────────────

  async getSlotsForGym(gymId: string, date: string, userId?: string) {
    await this.generateSlotsForGym(gymId, 8); // generate 8 days so any date in the date picker works
    const slots = await this.slotRepo.find({ where: { gymId, date, status: 'scheduled' }, order: { startTime: 'ASC' } });
    const [types, schedule] = await Promise.all([
      this.typeRepo.find({ where: { gymId } }),
      this.scheduleRepo.findOne({ where: { gymId, dayOfWeek: dayOfWeekFromDate(date) } }),
    ]);

    let userBookedSlotId: string | null = null;
    if (userId) {
      const ex = await this.bookingRepo.findOne({ where: { userId, gymId, slotDate: date } as any });
      if (ex) userBookedSlotId = ex.slotId;
    }

    const now = nowTimeIST();
    return slots
      .filter((s) => date > todayIST() || s.startTime > now)
      .filter((s) => {
        const type = types.find((t) => t.id === s.sessionTypeId);
        return type?.kind !== 'standard' || !overlapsWindow(s.startTime, s.endTime, schedule?.breakStartTime, schedule?.breakEndTime);
      })
      .map((s) => ({
        ...s,
        sessionType: types.find((t) => t.id === s.sessionTypeId),
        isFull: s.bookedCount >= s.maxCapacity,
        userBooked: userBookedSlotId === s.id,
        userHasBookingToday: !!userBookedSlotId,
      }));
  }

  async getUpcomingForGym(gymId: string, userId?: string) {
    const today = todayIST();
    await this.generateSlotsForGym(gymId, 8);
    const endDate = addDays(today, 7);

    const slots = await this.slotRepo
      .createQueryBuilder('s')
      .where('s."gymId" = :gymId', { gymId })
      .andWhere('s.date >= :today AND s.date <= :endDate', { today, endDate })
      .andWhere("s.status = 'scheduled'")
      .orderBy('s.date', 'ASC').addOrderBy('s."startTime"', 'ASC')
      .getMany();

    const types = await this.typeRepo.find({ where: { gymId } });
    let userBookings: SessionBookingEntity[] = [];
    if (userId) {
      userBookings = await this.bookingRepo
        .createQueryBuilder('b')
        .where('b."userId" = :userId AND b."gymId" = :gymId', { userId, gymId })
        .andWhere("b.status IN ('confirmed','attended')")
        .getMany();
    }

    const now = nowTimeIST();
    return slots
      .filter((s) => s.date > today || s.startTime > now)
      .map((s) => ({
        ...s,
        sessionType: types.find((t) => t.id === s.sessionTypeId),
        isFull: s.bookedCount >= s.maxCapacity,
        userBooked: userBookings.some((b) => b.slotId === s.id && b.status === 'confirmed'),
      }));
  }

  async bookSlot(userId: string, dto: BookSlotDto) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(dto.slotId)) throw new NotFoundException('Slot not found');
    const slot = await this.slotRepo.findOne({ where: { id: dto.slotId } });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.status !== 'scheduled') throw new BadRequestException('This slot is not available');
    if (slot.bookedCount >= slot.maxCapacity) throw new BadRequestException('Slot is full');
    const [slotType, slotSchedule] = await Promise.all([
      this.typeRepo.findOne({ where: { id: slot.sessionTypeId } }),
      this.scheduleRepo.findOne({ where: { gymId: slot.gymId, dayOfWeek: dayOfWeekFromDate(slot.date) } }),
    ]);
    if (slotType?.kind === 'standard' && overlapsWindow(slot.startTime, slot.endTime, slotSchedule?.breakStartTime, slotSchedule?.breakEndTime)) {
      throw new BadRequestException('This gym is on break during the selected time. Please choose another slot.');
    }

    // Find subscription first (needed for planType-aware lock rules)
    const sub = dto.subscriptionId
      ? await this.subRepo.findOne({ where: { id: dto.subscriptionId, userId } })
      : await this.subRepo.createQueryBuilder('sub')
        .where('sub."userId" = :userId', { userId })
        .andWhere('sub.status = :status', { status: 'active' })
        .andWhere('sub."endDate" >= CURRENT_DATE')
        .andWhere('(sub."planType" = :multiGym OR :gymId = ANY(sub."gymIds"))', { multiGym: 'multi_gym', gymId: slot.gymId })
        .orderBy(`CASE WHEN :gymId = ANY(sub."gymIds") THEN 0 ELSE 1 END`, 'ASC')
        .addOrderBy('sub."createdAt"', 'DESC')
        .getOne();
    if (!sub) throw new BadRequestException('No active subscription found. Please subscribe first.');
    if (sub.status !== 'active' || String(sub.endDate) < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('No active subscription found. Please subscribe first.');
    }

    // Validate planType against the gym being booked
    const subGymIds: string[] = (sub.gymIds as any) || [];
    if (sub.planType === 'same_gym') {
      if (!subGymIds.includes(slot.gymId)) {
        throw new BadRequestException('Your Same Gym Pass is only valid for the gym you subscribed to.');
      }
    } else if (sub.planType === 'day_pass') {
      if (subGymIds.length > 0 && !subGymIds.includes(slot.gymId)) {
        throw new BadRequestException('Your 1-Day Pass is for a different gym.');
      }
    }
    // multi_gym: valid at any gym — no gym check needed

    // Daily session lock — day_pass is exempt (can book multiple passes per day)
    if (sub.planType !== 'day_pass') {
      if (sub.planType === 'multi_gym') {
        // Cross-gym lock for multi_gym: only 1 session per day across ALL gyms
        const multiDayExisting = await this.bookingRepo.findOne({
          where: { userId, slotDate: slot.date } as any,
        });
        if (multiDayExisting && multiDayExisting.status !== 'cancelled') {
          throw new ConflictException('Your Multi Gym Pass allows 1 session per day across all gyms. You already have a session booked today.');
        }
      } else {
        // same_gym: 1 session per day at this gym
        const dayExisting = await this.bookingRepo.findOne({
          where: { userId, gymId: slot.gymId, slotDate: slot.date } as any,
        });
        if (dayExisting && dayExisting.status !== 'cancelled') {
          throw new ConflictException('You already have a session booked at this gym for this day. Only 1 session per day is allowed.');
        }
      }
    }

    const booking = (await this.bookingRepo.save(
      this.bookingRepo.create({
        slotId: slot.id, userId, gymId: slot.gymId,
        subscriptionId: sub.id, slotDate: slot.date,
        status: 'confirmed', bookingRef: randomRef(),
      } as any),
    )) as any as SessionBookingEntity;

    slot.bookedCount += 1;
    if (slot.bookedCount >= slot.maxCapacity) slot.status = 'full';
    await this.slotRepo.save(slot);

    const [sessionType, gym, user] = await Promise.all([
      slotType || this.typeRepo.findOne({ where: { id: slot.sessionTypeId } }),
      this.gymRepo.findOne({ where: { id: slot.gymId } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    this.sendBookingConfirmation({ booking, slot, sessionType, gym, user }).catch(() => {});

    const jti = uuidv4();
    const bookedAt = new Date();
    const expiresAt = bookingQrExpiryForSlot(slot);
    const expiresInSeconds = Math.max(60, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));

    const qrPayload = {
      sub: userId,
      gym: slot.gymId,
      sid: sub.id,
      bid: booking.id,
      jti,
      type: 'booking',
    };
    const qrToken = this.jwt.sign(qrPayload, { expiresIn: `${expiresInSeconds}s` });

    const bookingQr = await this.qrRepo.save(
      this.qrRepo.create({
        userId,
        gymId: slot.gymId,
        subscriptionId: sub.id,
        slotBookingId: booking.id,
        qrToken,
        expiresAt,
        bookedAt,
      }),
    );

    return {
      ...booking,
      slot,
      sessionType,
      gym,
      bookingQr: {
        id: bookingQr.id,
        token: qrToken,
        expiresAt: expiresAt.toISOString(),
        bookedAt: bookedAt.toISOString(),
        gymId: slot.gymId,
        gymName: gym?.name ?? '',
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        manualCode: booking.bookingRef || booking.id,
      },
    } as any;
  }

  private async sendBookingConfirmation(ctx: {
    booking: SessionBookingEntity;
    slot: SessionSlotEntity;
    sessionType: SessionTypeEntity | null;
    gym: GymEntity | null;
    user: UserEntity | null;
  }) {
    const { booking, slot, sessionType, gym, user } = ctx;
    const sName = sessionType?.name ?? 'Session';
    const gName = gym?.name ?? 'Your Gym';
    const uName = user?.name ?? 'Member';
    const dateLabel = new Date(slot.date + 'T12:00:00Z').toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const html = (heading: string, extra = '') => `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
        <div style="color:#3DFF54;font-size:22px;font-weight:700;margin-bottom:8px">BookMyFit</div>
        <h2>${heading}</h2>
        <div style="background:#111;border:1px solid #333;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:4px 0;color:#fff"><strong>${sName}</strong></p>
          <p style="margin:4px 0;color:#aaa">📍 ${gName}</p>
          <p style="margin:4px 0;color:#aaa">📅 ${dateLabel}</p>
          <p style="margin:4px 0;color:#aaa">🕐 ${slot.startTime} – ${slot.endTime}</p>
          <p style="margin:8px 0 0;color:#3DFF54;font-weight:700;letter-spacing:2px">REF: ${booking.bookingRef}</p>
        </div>
        ${extra}
      </div>`;

    if ((user as any)?.email) {
      await this.email.sendRaw(
        (user as any).email,
        `Session Confirmed – ${sName} at ${gName}`,
        html('Session Confirmed ✅', '<p style="color:#aaa">Show your QR code at the gym entrance to check in.</p>'),
      );
    }
    if ((gym as any)?.ownerEmail) {
      await this.email.sendRaw(
        (gym as any).ownerEmail,
        `New Booking – ${sName} on ${slot.date}`,
        html(`New Booking at ${gName}`, `<p style="color:#aaa">Member: ${uName}</p>`),
      );
    }
  }

  async cancelBooking(userId: string, bookingId: string) {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId, userId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'confirmed') throw new BadRequestException('Cannot cancel this booking');
    booking.status = 'cancelled';
    await this.bookingRepo.save(booking);
    await this.qrRepo.createQueryBuilder()
      .update(BookingQrEntity)
      .set({ usedAt: new Date() })
      .where('"slotBookingId" = :bookingId', { bookingId: booking.id })
      .andWhere('"usedAt" IS NULL')
      .execute();
    const slot = await this.slotRepo.findOne({ where: { id: booking.slotId } });
    if (slot && slot.bookedCount > 0) {
      slot.bookedCount -= 1;
      if (slot.status === 'full') slot.status = 'scheduled';
      await this.slotRepo.save(slot);
    }
    return { success: true };
  }

  async myBookings(userId: string) {
    const bookings = await this.bookingRepo.find({ where: { userId } as any, order: { bookedAt: 'DESC' }, take: 50 });
    if (bookings.length === 0) return [];
    const slotIds = bookings.map((b) => b.slotId);
    const slots = await this.slotRepo.createQueryBuilder('s').whereInIds(slotIds).getMany();
    const gymIds = [...new Set(slots.map((s) => s.gymId))];
    const typeIds = [...new Set(slots.map((s) => s.sessionTypeId))];
    const [gyms, types] = await Promise.all([
      gymIds.length ? this.gymRepo.createQueryBuilder('g').whereInIds(gymIds).getMany() : [],
      typeIds.length ? this.typeRepo.createQueryBuilder('t').whereInIds(typeIds).getMany() : [],
    ]);
    return bookings.map((b) => {
      const slot = slots.find((s) => s.id === b.slotId);
      return { ...b, slot, sessionType: slot ? types.find((t) => t.id === slot.sessionTypeId) : null, gym: slot ? gyms.find((g) => g.id === slot.gymId) : null };
    });
  }

  // ── QR Check-in ──────────────────────────────────────────────────────────

  async processCheckin(userId: string, gymId: string) {
    const today = todayIST();
    const nowTime = nowTimeIST();

    const sub = await this.subRepo.createQueryBuilder('sub')
      .where('sub."userId" = :userId', { userId })
      .andWhere('sub.status = :status', { status: 'active' })
      .andWhere('sub."endDate" >= CURRENT_DATE')
      .andWhere('(sub."planType" = :multiGym OR :gymId = ANY(sub."gymIds"))', { multiGym: 'multi_gym', gymId })
      .orderBy(`CASE WHEN :gymId = ANY(sub."gymIds") THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('sub."createdAt"', 'DESC')
      .getOne();
    if (!sub) return { success: false, reason: 'no_active_subscription', message: 'No active subscription.' };

    // Already attended today?
    const alreadyAttended = await this.bookingRepo.findOne({
      where: { userId, gymId, slotDate: today, status: 'attended' } as any,
    });
    if (alreadyAttended) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      return { success: true, alreadyCheckedIn: true, message: `${user?.name ?? 'Member'} already checked in today.`, checkinAt: alreadyAttended.checkinAt };
    }

    // Find active booking matching current time window
    const confirmedBooking = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin(SessionSlotEntity, 's', 'b."slotId" = s.id')
      .where('b."userId" = :userId AND b."gymId" = :gymId AND b."slotDate" = :today', { userId, gymId, today })
      .andWhere("b.status = 'confirmed'")
      .andWhere('s."startTime" <= :nowTime AND s."endTime" > :nowTime', { nowTime })
      .select('b')
      .getOne();

    let booking: SessionBookingEntity;
    let sessionType: SessionTypeEntity | null = null;
    let isAutoGen = false;

    if (confirmedBooking) {
      booking = confirmedBooking;
      const slot = await this.slotRepo.findOne({ where: { id: booking.slotId } });
      if (slot) sessionType = await this.typeRepo.findOne({ where: { id: slot.sessionTypeId } });
    } else {
      // Walk-in: auto-create Gym Workout booking for current hour
      isAutoGen = true;
      sessionType = await this.ensureGymWorkout(gymId);
      const hourStart = nowTime.substring(0, 2) + ':00';
      const nextHour = String((Number(nowTime.substring(0, 2)) + 1) % 24).padStart(2, '0');
      const hourEnd = `${nextHour}:00`;
      const schedule = await this.scheduleRepo.findOne({ where: { gymId, dayOfWeek: dayOfWeekFromDate(today) } });
      if (!schedule?.isOpen || hourStart < (schedule?.openTime ?? '06:00') || hourEnd > (schedule?.closeTime ?? '22:00') || overlapsWindow(hourStart, hourEnd, schedule?.breakStartTime, schedule?.breakEndTime)) {
        throw new BadRequestException('This gym is closed or on break right now.');
      }

      let slot = await this.slotRepo.findOne({
        where: { gymId, sessionTypeId: sessionType.id, date: today, startTime: hourStart },
      });
      if (!slot) {
        slot = (await this.slotRepo.save(
          this.slotRepo.create({
            gymId, sessionTypeId: sessionType.id, date: today,
            startTime: hourStart, endTime: hourEnd,
            maxCapacity: sessionType.maxCapacity, bookedCount: 0, status: 'scheduled',
          } as any),
        )) as any;
      }

      booking = (await this.bookingRepo.save(
        this.bookingRepo.create({
          slotId: slot!.id, userId, gymId, subscriptionId: sub.id,
          slotDate: today, status: 'confirmed', isAutoGenerated: true, bookingRef: randomRef(),
        } as any),
      )) as any;
      slot.bookedCount += 1;
      await this.slotRepo.save(slot);
    }

    // Mark attended
    booking.status = 'attended';
    (booking as any).checkinAt = new Date();
    await this.bookingRepo.save(booking);

    // Fetch gym to get its configured ratePerDay for the billing record
    const gymEntity = await this.gymRepo.findOne({ where: { id: gymId } });
    const commissionAmount = gymEntity?.ratePerDay ?? 30;

    // Create Attendance record — commissionAmount is what BMF owes this gym per visit-day
    const attendance = await this.attendanceRepo.save(
      this.attendanceRepo.create({
        bookingId: booking.id, gymId, userId, subscriptionId: sub.id,
        sessionDate: today, sessionTypeName: sessionType?.name ?? 'Gym Workout',
        sessionKind: sessionType?.kind ?? 'standard',
        checkinAt: new Date(), commissionAmount,
      } as any),
    );

    const user = await this.userRepo.findOne({ where: { id: userId } });

    return {
      success: true, alreadyCheckedIn: false, isAutoGenerated: isAutoGen,
      message: `✅ Welcome, ${user?.name ?? 'Member'}! Checked in for ${sessionType?.name ?? 'Gym Workout'}.`,
      user: { id: userId, name: user?.name, phone: (user as any)?.phone },
      gym: { id: gymId, name: gymEntity?.name },
      booking, attendance, sessionType,
    };
  }

  // ── Not-Attended Cron (every 5 min) ─────────────────────────────────────

  @Cron('*/5 * * * *')
  async markNotAttended() {
    const today = todayIST();
    const nowTime = nowTimeIST();

    const expired = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin(SessionSlotEntity, 's', 'b."slotId" = s.id')
      .where('b."slotDate" = :today', { today })
      .andWhere("b.status = 'confirmed'")
      .andWhere('s."endTime" < :nowTime', { nowTime })
      .select('b')
      .getMany();

    if (expired.length === 0) return;

    for (const b of expired) {
      b.status = 'not_attended';
      await this.bookingRepo.save(b);

      // Push/email notification
      const user = await this.userRepo.findOne({ where: { id: b.userId } });
      if ((user as any)?.email) {
        const slot = await this.slotRepo.findOne({ where: { id: b.slotId } });
        const st = slot ? await this.typeRepo.findOne({ where: { id: slot.sessionTypeId } }) : null;
        this.email.sendRaw(
          (user as any).email,
          'You missed your session today',
          `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
            <div style="color:#3DFF54;font-size:22px;font-weight:700;margin-bottom:8px">BookMyFit</div>
            <h2 style="color:#FF6B6B">Session Missed 😔</h2>
            <p style="color:#aaa">Hi ${user?.name ?? 'Member'}, you missed your <strong>${st?.name ?? 'session'}</strong> today (${slot?.startTime ?? ''} – ${slot?.endTime ?? ''}).</p>
            <p style="color:#aaa">Book your next session on the BookMyFit app and keep going!</p>
          </div>`,
        ).catch(() => {});
      }
    }
    this.logger.log(`Marked ${expired.length} booking(s) as not_attended`);
  }

  // ── Attendance & Admin ───────────────────────────────────────────────────

  async listAttendance(gymId?: string, date?: string, page = 1, limit = 50) {
    const qb = this.attendanceRepo.createQueryBuilder('a');
    if (gymId) qb.andWhere('a."gymId" = :gymId', { gymId });
    if (date) qb.andWhere('a."sessionDate" = :date', { date });
    const [data, total] = await qb.orderBy('a."checkinAt"', 'DESC').skip((Number(page) - 1) * Number(limit)).take(Number(limit)).getManyAndCount();
    const gymIds = [...new Set(data.map((a) => a.gymId))];
    const userIds = [...new Set(data.map((a) => a.userId))];
    const [gyms, users] = await Promise.all([
      gymIds.length ? this.gymRepo.createQueryBuilder('g').whereInIds(gymIds).getMany() : [],
      userIds.length ? this.userRepo.createQueryBuilder('u').whereInIds(userIds).getMany() : [],
    ]);
    return { data: data.map((a) => ({ ...a, gym: gyms.find((g) => g.id === a.gymId), user: users.find((u) => u.id === a.userId) })), total, page: Number(page), limit: Number(limit) };
  }

  async attendanceSummaryByGym(month: string) {
    const [y, m] = month.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const toM = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const rows = await this.attendanceRepo
      .createQueryBuilder('a')
      .select('a."gymId"', 'gymId')
      .addSelect('COUNT(*)', 'totalAttendance')
      .addSelect('SUM(a."commissionAmount")', 'totalCommission')
      .where('a."sessionDate" >= :from AND a."sessionDate" < :to', { from, to: toM })
      .groupBy('a."gymId"')
      .getRawMany();
    const gymIds = rows.map((r) => r.gymId);
    const gyms = gymIds.length ? await this.gymRepo.createQueryBuilder('g').whereInIds(gymIds).getMany() : [];
    return rows.map((r) => ({ ...r, gym: gyms.find((g) => g.id === r.gymId) }));
  }

  async getGymIdForOwner(ownerId: string): Promise<string> {
    const gym = await this.gymRepo.findOne({ where: { ownerId } });
    if (!gym) throw new NotFoundException('Gym not found for this account');
    return gym.id;
  }

  private async enrichBookings(bookings: SessionBookingEntity[]) {
    if (bookings.length === 0) return [];
    const slotIds = bookings.map((b) => b.slotId);
    const userIds = [...new Set(bookings.map((b) => b.userId))];
    const gymIds = [...new Set(bookings.map((b) => b.gymId))];
    const subIds = [...new Set(bookings.map((b) => b.subscriptionId).filter(Boolean))];
    const bookingIds = bookings.map((b) => b.id);
    const slots = await this.slotRepo.createQueryBuilder('s').whereInIds(slotIds).getMany();
    const typeIds = [...new Set(slots.map((s) => s.sessionTypeId))];
    const [users, gyms, types, subs, qrs] = await Promise.all([
      userIds.length ? this.userRepo.createQueryBuilder('u').whereInIds(userIds).getMany() : [],
      gymIds.length ? this.gymRepo.createQueryBuilder('g').whereInIds(gymIds).getMany() : [],
      typeIds.length ? this.typeRepo.createQueryBuilder('t').whereInIds(typeIds).getMany() : [],
      subIds.length ? this.subRepo.createQueryBuilder('sub').whereInIds(subIds).getMany() : [],
      bookingIds.length ? this.qrRepo.createQueryBuilder('q').where('q."slotBookingId" IN (:...bookingIds)', { bookingIds }).getMany() : [],
    ]);
    const planLabels: Record<string, string> = {
      day_pass: '1-Day Pass',
      same_gym: 'Same Gym Pass',
      multi_gym: 'Multi Gym Pass',
    };
    return bookings.map((b) => {
      const slot = slots.find((s) => s.id === b.slotId);
      const sub = subs.find((s) => s.id === b.subscriptionId);
      const qr = qrs.find((q) => q.slotBookingId === b.id);
      return {
        ...b,
        slot,
        sessionType: slot ? types.find((t) => t.id === slot.sessionTypeId) : null,
        user: users.find((u) => u.id === b.userId),
        gym: gyms.find((g) => g.id === b.gymId),
        subscription: sub ? {
          id: sub.id,
          planType: sub.planType,
          planName: planLabels[sub.planType] || sub.planType,
          status: sub.status,
          amountPaid: Number(sub.amountPaid || 0),
          startDate: sub.startDate,
          endDate: sub.endDate,
        } : null,
        planType: sub?.planType || null,
        planName: sub ? (planLabels[sub.planType] || sub.planType) : null,
        amountPaid: Number(sub?.amountPaid || 0),
        bookingQrId: qr?.id || null,
        bookingQrUsedAt: qr?.usedAt || null,
        bookingQrExpiresAt: qr?.expiresAt || null,
        manualCode: b.bookingRef || b.id,
      };
    });
  }

  async getBookingsForGym(gymId: string, date?: string) {
    const qb = this.bookingRepo.createQueryBuilder('b').where('b."gymId" = :gymId', { gymId });
    if (date) qb.andWhere('b."slotDate" = :date', { date });
    const bookings = await qb.orderBy('b."bookedAt"', 'DESC').take(100).getMany();
    return this.enrichBookings(bookings);
  }

  async listBookingsAdmin(page: any = 1, limit: any = 20, status?: string, gymId?: string) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const qb = this.bookingRepo.createQueryBuilder('b').orderBy('b."bookedAt"', 'DESC');
    if (status && status !== 'all') qb.andWhere('b.status = :status', { status });
    if (gymId) qb.andWhere('b."gymId" = :gymId', { gymId });
    const [bookings, total] = await Promise.all([
      qb.clone().skip(skip).take(take).getMany(),
      qb.clone().getCount(),
    ]);
    const data = await this.enrichBookings(bookings);
    return paginatedResponse(data, total, p, l);
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly svc: SessionsService) {}

  // Public
  @Get('slots/:gymId')
  getSlots(@Param('gymId') gymId: string, @Query('date') date: string, @Query('userId') userId?: string) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(gymId)) return [];
    return this.svc.getSlotsForGym(gymId, date || todayIST(), userId);
  }

  @Get('upcoming/:gymId')
  getUpcoming(@Param('gymId') gymId: string, @Query('userId') userId?: string) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(gymId)) return [];
    return this.svc.getUpcomingForGym(gymId, userId);
  }

  @Get('types/:gymId')
  getTypes(@Param('gymId') gymId: string) { return this.svc.getSessionTypes(gymId); }

  // Customer
  @Get('my-bookings')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard)
  myBookings(@Req() req: any) { return this.svc.myBookings(req.user.userId); }

  @Post('book')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard)
  book(@Req() req: any, @Body() dto: BookSlotDto) { return this.svc.bookSlot(req.user.userId, dto); }

  @Post('cancel/:bookingId')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard)
  cancel(@Req() req: any, @Param('bookingId') bookingId: string) { return this.svc.cancelBooking(req.user.userId, bookingId); }

  // Gym Owner
  @Get('schedule')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  async getSchedule(@Req() req: any) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.getSchedule(gymId);
  }

  @Put('schedule')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner')
  async upsertSchedule(@Req() req: any, @Body() dto: UpsertScheduleDto) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.upsertSchedule(gymId, dto);
  }

  @Get('session-types')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  async getSessionTypes(@Req() req: any) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.getSessionTypes(gymId);
  }

  @Post('session-types')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner')
  async createSessionType(@Req() req: any, @Body() dto: CreateSessionTypeDto) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.createSessionType(gymId, dto);
  }

  @Put('session-types/:id')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner')
  async updateSessionType(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSessionTypeDto) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.updateSessionType(gymId, id, dto);
  }

  @Delete('session-types/:id')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner')
  async deleteSessionType(@Req() req: any, @Param('id') id: string) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.deleteSessionType(gymId, id);
  }

  @Get('session-schedules')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  async getSessionSchedules(@Req() req: any) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.getSessionSchedules(gymId);
  }

  @Put('session-schedules')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner')
  async upsertSessionSchedule(@Req() req: any, @Body() dto: UpsertSessionScheduleDto) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.upsertSessionSchedule(gymId, dto);
  }

  @Delete('session-schedules/:id')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner')
  async deleteSessionSchedule(@Req() req: any, @Param('id') id: string) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.deleteSessionSchedule(gymId, id);
  }

  @Get('gym-bookings')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  async getGymBookings(@Req() req: any, @Query('date') date?: string) {
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.getBookingsForGym(gymId, date);
  }

  /** Called by gym portal QR scanner — body.userId decoded from scanned QR */
  @Post('checkin')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('gym_owner', 'gym_staff')
  async checkin(@Req() req: any, @Body() body: { userId: string }) {
    if (process.env.ALLOW_DIRECT_GYM_CHECKIN !== 'true') {
      throw new BadRequestException('Direct check-in is disabled. Use /qr/validate with a signed QR token.');
    }
    const gymId = await this.svc.getGymIdForOwner(req.user.userId);
    return this.svc.processCheckin(body.userId, gymId);
  }

  // Admin
  @Get('admin/attendance')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  listAttendance(@Query('gymId') gymId?: string, @Query('date') date?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.svc.listAttendance(gymId, date, page, limit);
  }

  @Get('admin/attendance/summary')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  attendanceSummary(@Query('month') month: string) {
    return this.svc.attendanceSummaryByGym(month || new Date().toISOString().substring(0, 7));
  }

  @Get('admin/bookings')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  adminBookings(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('gymId') gymId?: string,
  ) {
    return this.svc.listBookingsAdmin(page, limit, status, gymId);
  }

  @Post('admin/generate-slots/:gymId')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')
  generateSlots(@Param('gymId') gymId: string, @Query('days') days = 30) {
    return this.svc.generateSlotsForGym(gymId, Number(days));
  }
}

// ─── Module ──────────────────────────────────────────────────────────────────

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GymScheduleEntity, SessionTypeEntity, SessionScheduleEntity,
      SessionSlotEntity, SessionBookingEntity, AttendanceEntity,
      GymEntity, SubscriptionEntity, UserEntity, CheckinEntity,
      BookingQrEntity,
    ]),
    EmailModule,
    JwtModule.register({
      secret: process.env.QR_SECRET || 'qr-hmac-secret-change-me',
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
