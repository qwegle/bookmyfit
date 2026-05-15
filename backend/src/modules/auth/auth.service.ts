import { Injectable, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { UserEntity } from '../../database/entities/user.entity';
import { GymEntity } from '../../database/entities/gym.entity';
import { CorporateAccountEntity } from '../../database/entities/corporate.entity';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(GymEntity) private readonly gyms: Repository<GymEntity>,
    @InjectRepository(CorporateAccountEntity) private readonly corporates: Repository<CorporateAccountEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  async sendOtp(phone: string) {
    const smsConfigured = process.env.TWILIO_ACCOUNT_SID &&
      !process.env.TWILIO_ACCOUNT_SID.startsWith('xxxxx') &&
      process.env.TWILIO_ACCOUNT_SID !== 'placeholder';

    // Use fixed dev OTP when SMS is not configured (no Twilio keys set)
    const code = smsConfigured
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : '123456';

    await this.redis.set(`otp:${phone}`, code, 'EX', 600);

    if (smsConfigured) {
      // TODO: uncomment when Twilio is live
      // await twilio.messages.create({ to: `+91${phone}`, from: process.env.TWILIO_PHONE_NUMBER, body: `Your BookMyFit OTP: ${code}` });
    }

    const existingUser = await this.users.findOne({ where: { phone } });
    return {
      success: true,
      message: smsConfigured ? 'OTP sent via SMS' : 'OTP sent',
      userExists: !!existingUser,
      userName: existingUser?.name || null,
      // Always expose devOtp when SMS is not configured so app can show the hint
      ...(!smsConfigured && { devOtp: code }),
    };
  }

  async verifyOtp(phone: string, code: string, deviceId: string, name?: string) {
    const stored = await this.redis.get(`otp:${phone}`);
    if (!stored || stored !== code) throw new UnauthorizedException('Invalid or expired OTP');
    await this.redis.del(`otp:${phone}`);

    let user = await this.users.findOne({ where: { phone } });
    if (!user) {
      user = this.users.create({ phone, name: name || 'User', deviceId, role: 'end_user' });
      user = await this.users.save(user);
    } else if (user.deviceId && user.deviceId !== deviceId) {
      user.deviceId = deviceId;
      await this.users.save(user);
    } else if (!user.deviceId) {
      user.deviceId = deviceId;
      await this.users.save(user);
    }

    return this.issueTokens(user);
  }

  async setupFirstAdmin(email: string, password: string) {
    const existing = await this.users.findOne({ where: { role: 'super_admin' } });
    if (existing) throw new BadRequestException('Admin already exists. Use /auth/admin/login instead.');
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = this.users.create({ email, passwordHash, name: 'Super Admin', role: 'super_admin', isActive: true });
    await this.users.save(admin);
    return this.issueTokens(admin);
  }

  async passwordLogin(email: string, password: string) {
    const user = await this.users.findOne({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      });
      const user = await this.users.findOne({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async registerGym(data: {
    email: string; password: string; name: string;
    gymName: string; city: string; area: string; address: string; phone?: string; lat?: number; lng?: number;
  }) {
    const existing = await this.users.findOne({ where: { email: data.email } });
    if (existing) throw new BadRequestException('An account with this email already exists');
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.users.save(
      this.users.create({ email: data.email, name: data.name, phone: data.phone, passwordHash, role: 'gym_owner', isActive: true }),
    );
    const gym = await this.gyms.save(
      this.gyms.create({
        name: data.gymName, city: data.city, area: data.area,
        address: data.address,
        lat: Number.isFinite(Number(data.lat)) ? Number(data.lat) : 0,
        lng: Number.isFinite(Number(data.lng)) ? Number(data.lng) : 0,
        status: 'pending', ownerId: user.id, kycStatus: 'not_started',
      }),
    );
    // Fire-and-forget welcome email
    this.email.sendGymRegistered({ gymName: data.gymName, ownerName: data.name, email: data.email }).catch(() => {});
    return { ...this.issueTokens(user), gym };
  }

  async registerCorporate(data: {
    email: string; password: string; companyName: string; billingContact: string;
  }) {
    const existing = await this.users.findOne({ where: { email: data.email } });
    if (existing) throw new BadRequestException('An account with this email already exists');
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.users.save(
      this.users.create({ email: data.email, name: data.companyName, passwordHash, role: 'corporate_admin', isActive: true }),
    );
    const corporate = await this.corporates.save(
      this.corporates.create({
        companyName: data.companyName, email: data.email,
        billingContact: data.billingContact, planType: 'multigym',
        totalSeats: 0, assignedSeats: 0, adminUserId: user.id, isActive: true,
      }),
    );
    // Fire-and-forget welcome email
    this.email.sendCorporateRegistered({ companyName: data.companyName, adminName: data.companyName, email: data.email }).catch(() => {});
    return { ...this.issueTokens(user), corporate };
  }

  private issueTokens(user: UserEntity) {
    const payload = { sub: user.id, role: user.role, phone: user.phone, email: user.email };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, phone: user.phone, name: user.name, email: user.email, role: user.role },
    };
  }
}
