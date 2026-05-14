import { Injectable, Inject, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { CheckinEntity } from '../../database/entities/checkin.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { GymEntity } from '../../database/entities/gym.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { FraudAlertEntity } from '../../database/entities/misc.entity';
import { BookingQrEntity } from '../../database/entities/booking-qr.entity';
import { SessionBookingEntity } from '../../database/entities/session-booking.entity';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

const QR_EXPIRY_SECONDS = 30;
const VELOCITY_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const VELOCITY_THRESHOLD = 3;

function isPastDateOnly(endDate: string | Date) {
  const iso = endDate instanceof Date ? endDate.toISOString().slice(0, 10) : String(endDate).slice(0, 10);
  return iso < new Date().toISOString().slice(0, 10);
}

@Injectable()
export class QrService {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(CheckinEntity) private readonly checkins: Repository<CheckinEntity>,
    @InjectRepository(SubscriptionEntity) private readonly subs: Repository<SubscriptionEntity>,
    @InjectRepository(GymEntity) private readonly gyms: Repository<GymEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(FraudAlertEntity) private readonly fraudAlerts: Repository<FraudAlertEntity>,
    @InjectRepository(BookingQrEntity) private readonly bookingQrs: Repository<BookingQrEntity>,
    @InjectRepository(SessionBookingEntity) private readonly sessionBookings: Repository<SessionBookingEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Mobile app calls this to generate a short-lived QR token */
  async generateQr(userId: string, subscriptionId: string) {
    const sub = await this.subs.findOne({ where: { id: subscriptionId, userId } });
    if (!sub) throw new BadRequestException('Subscription not found');
    if (sub.status !== 'active') throw new BadRequestException('Subscription is not active');
    if (isPastDateOnly(sub.endDate)) throw new BadRequestException('Subscription has expired');

    const jti = uuidv4();
    const payload = {
      sub: userId,
      sid: subscriptionId,
      jti,
      iat: Math.floor(Date.now() / 1000),
    };
    const token = this.jwt.sign(payload, { expiresIn: `${QR_EXPIRY_SECONDS}s` });
    return { token, expiresIn: QR_EXPIRY_SECONDS, expiresAt: new Date(Date.now() + QR_EXPIRY_SECONDS * 1000).toISOString() };
  }

  /** Gym panel scanner calls this with the QR token */
  async validateQr(qrToken: string, gymId: string) {
    // 1. Verify JWT signature + expiry
    let payload: any;
    try {
      payload = this.jwt.verify(qrToken);
    } catch (err: any) {
      await this.logFailure(qrToken, gymId, 'failed_expired', err.message);
      throw new UnauthorizedException('QR code expired or invalid');
    }

    const { sub: userId, sid: subscriptionId, jti } = payload;
    const isBookingQr = payload.type === 'booking' || !!payload.bid;

    // 2. Idempotency: has this JTI been used?
    const alreadyUsed = await this.redis.exists(`qr:used:${jti}`);
    if (alreadyUsed) {
      await this.logFailure(qrToken, gymId, 'failed_invalid', 'Duplicate QR');
      throw new ConflictException('QR already used');
    }

    let bookingQr: BookingQrEntity | null = null;
    if (isBookingQr) {
      if (payload.gym !== gymId) {
        await this.logFailure(qrToken, gymId, 'failed_invalid', 'QR booked for another gym');
        throw new UnauthorizedException('This booking QR is for another gym');
      }

      bookingQr = await this.bookingQrs.findOne({ where: { qrToken } });
      if (
        !bookingQr ||
        bookingQr.userId !== userId ||
        bookingQr.subscriptionId !== subscriptionId ||
        bookingQr.gymId !== gymId ||
        (payload.bid && bookingQr.slotBookingId !== payload.bid)
      ) {
        await this.logFailure(qrToken, gymId, 'failed_invalid', 'Booking QR record mismatch');
        throw new UnauthorizedException('Booking QR is invalid');
      }
      if (bookingQr.usedAt) {
        await this.logFailure(qrToken, gymId, 'failed_invalid', 'Booking QR already used');
        throw new ConflictException('QR already used');
      }
      if (new Date(bookingQr.expiresAt) <= new Date()) {
        await this.logFailure(qrToken, gymId, 'failed_expired', 'Booking QR expired');
        throw new UnauthorizedException('QR code expired or invalid');
      }
    }

    // 3. Daily lock: has user already checked in today?
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `checkin:daily:${userId}:${today}`;
    const existingCheckinGymId = await this.redis.get(dailyKey);
    if (existingCheckinGymId && existingCheckinGymId !== gymId) {
      await this.logFailure(qrToken, gymId, 'failed_daily_limit', `Already checked in at ${existingCheckinGymId}`);
      throw new ConflictException('Already checked in at another gym today');
    }

    // 4. Validate subscription + plan allows this gym
    const sub = await this.subs.findOne({ where: { id: subscriptionId } });
    if (!sub || sub.userId !== userId || sub.status !== 'active' || isPastDateOnly(sub.endDate)) {
      await this.logFailure(qrToken, gymId, 'failed_invalid', 'No active subscription');
      throw new UnauthorizedException('Subscription not active');
    }

    const coveredGyms = sub.gymIds || [];
    if (sub.planType === 'same_gym' && !coveredGyms.includes(gymId)) {
      await this.logFailure(qrToken, gymId, 'failed_invalid', 'Gym not in plan');
      throw new UnauthorizedException('This plan does not cover this gym');
    }
    if (sub.planType === 'day_pass' && coveredGyms.length > 0 && !coveredGyms.includes(gymId)) {
      await this.logFailure(qrToken, gymId, 'failed_invalid', 'Day pass is for a different gym');
      throw new UnauthorizedException('This day pass does not cover this gym');
    }

    const gym = await this.gyms.findOne({ where: { id: gymId } });
    if (!gym || gym.status !== 'active') {
      await this.logFailure(qrToken, gymId, 'failed_invalid', 'Gym inactive');
      throw new BadRequestException('Gym not available');
    }

    // 5. Mark used + daily lock
    const ttl = payload.exp ? Math.max(60, payload.exp - Math.floor(Date.now() / 1000)) : 60;
    await this.redis.set(`qr:used:${jti}`, '1', 'EX', ttl);
    await this.redis.set(dailyKey, gymId, 'EX', 24 * 60 * 60);
    if (bookingQr) {
      const update = await this.bookingQrs
        .createQueryBuilder()
        .update(BookingQrEntity)
        .set({ usedAt: new Date() })
        .where('id = :id', { id: bookingQr.id })
        .andWhere('"usedAt" IS NULL')
        .execute();
      if (!update.affected) throw new ConflictException('QR already used');

      await this.sessionBookings.update(
        { id: bookingQr.slotBookingId },
        { status: 'attended' as any, checkinAt: new Date() },
      );
    }

    // 6. Record check-in
    const checkin = await this.checkins.save(
      this.checkins.create({
        userId,
        gymId,
        subscriptionId,
        qrToken,
        status: 'success',
      }),
    );
    const user = await this.users.findOne({ where: { id: userId } });
    const ratePerDay = Number((gym as any).ratePerDay ?? 50);
    const commissionRate = Number((gym as any).commissionRate ?? 15) / 100;
    const gymEarns = ratePerDay * (1 - commissionRate);
    const adminEarns = ratePerDay * commissionRate;

    // 7. Async velocity fraud check (non-blocking)
    this.checkVelocityFraud(userId, gymId, gym.name);

    return {
      success: true,
      checkinId: checkin.id,
      user: { id: userId, name: user?.name, phone: user?.phone || user?.email },
      gym: { id: gym.id, name: gym.name },
      planType: sub.planType,
      gymEarns,
      adminEarns,
      checkinTime: checkin.checkinTime,
    };
  }

  private async checkVelocityFraud(userId: string, gymId: string, gymName: string) {
    try {
      const since = new Date(Date.now() - VELOCITY_WINDOW_MS);
      const recentCount = await this.checkins
        .createQueryBuilder('c')
        .where('c.userId = :userId', { userId })
        .andWhere('c.status = :status', { status: 'success' })
        .andWhere('c.checkinTime >= :since', { since })
        .getCount();

      if (recentCount >= VELOCITY_THRESHOLD) {
        await this.fraudAlerts.save(
          this.fraudAlerts.create({
            userId,
            eventType: 'velocity_check',
            gymId,
            gymName,
            riskScore: Math.min(50 + recentCount * 10, 100),
            details: `User checked in ${recentCount} times within the last hour`,
            status: 'open',
          }),
        );
      }
    } catch {
      // swallow fraud check errors to not disrupt check-in flow
    }
  }

  private async logFailure(qrToken: string, gymId: string, status: any, reason: string) {
    try {
      await this.checkins.save(
        this.checkins.create({
          userId: '00000000-0000-0000-0000-000000000000',
          gymId,
          subscriptionId: '00000000-0000-0000-0000-000000000000',
          qrToken: `${qrToken}-fail-${Date.now()}`,
          status,
          failReason: reason,
        }),
      );
    } catch {/* swallow log failures */}
  }

  async getUserHistory(userId: string, limit = 50) {
    return this.checkins.find({
      where: { userId, status: 'success' },
      order: { checkinTime: 'DESC' },
      take: limit,
    });
  }
}
