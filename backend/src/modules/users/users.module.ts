import { Module, Controller, Get, Post, Put, Body, UseGuards, Req, Query, Param, BadRequestException } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { paginate, paginatedResponse } from '../../common/pagination.helper';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Injectable } from '@nestjs/common';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { GymEntity } from '../../database/entities/gym.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';

function generateCode(): string {
  return 'BMF' + Math.random().toString(36).toUpperCase().slice(2, 7);
}

class UpdateUserDto {
  name?: string;
  email?: string;
  dob?: string;
  gender?: string;
}

const USER_ROLES: UserRole[] = ['super_admin', 'gym_owner', 'gym_staff', 'corporate_admin', 'wellness_partner', 'end_user'];

@Injectable()
class UsersService {
  constructor(
    @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>,
    @InjectRepository(SubscriptionEntity) private readonly subs: Repository<SubscriptionEntity>,
    @InjectRepository(GymEntity) private readonly gyms: Repository<GymEntity>,
  ) {}

  me(id: string) { return this.repo.findOne({ where: { id } }); }
  async list(page: any = 1, limit: any = 20, search?: string, role?: UserRole) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const qb = this.repo.createQueryBuilder('u').orderBy('u.createdAt', 'DESC').skip(skip).take(take);
    if (role) {
      if (!USER_ROLES.includes(role)) throw new BadRequestException('Invalid role');
      qb.andWhere('u.role = :role', { role });
    }
    if (search) qb.andWhere('(u.name ILIKE :s OR u.phone ILIKE :s OR u.email ILIKE :s)', { s: `%${search}%` });
    const [data, total] = await qb.getManyAndCount();
    const userIds = data.map((u) => u.id);
    const subs = userIds.length
      ? await this.subs.createQueryBuilder('s')
        .where('s."userId" IN (:...userIds)', { userIds })
        .orderBy('s."createdAt"', 'DESC')
        .getMany()
      : [];
    const gymIds = [...new Set(subs.flatMap((s) => s.gymIds || []).filter(Boolean))];
    const gyms = gymIds.length ? await this.gyms.find({ where: { id: In(gymIds) } }) : [];
    const gymMap = new Map(gyms.map((g) => [g.id, g]));
    const nowDate = new Date().toISOString().slice(0, 10);
    const planLabels: Record<string, string> = {
      day_pass: '1-Day Pass',
      same_gym: 'Same Gym Pass',
      multi_gym: 'Multi Gym Pass',
    };
    const enriched = data.map((user) => {
      const userSubs = subs.filter((s) => s.userId === user.id);
      const current = userSubs.find((s) => s.status === 'active' && String(s.endDate).slice(0, 10) >= nowDate) || userSubs[0] || null;
      const currentGymId = current?.gymIds?.[0];
      const currentGym = currentGymId ? gymMap.get(currentGymId) : null;
      const subscriptionStatus = current
        ? (current.status === 'active' && String(current.endDate).slice(0, 10) < nowDate ? 'expired' : current.status)
        : 'none';
      return {
        ...user,
        subscriptionStatus,
        currentSubscription: current ? {
          id: current.id,
          planType: current.planType,
          planName: planLabels[current.planType] || current.planType,
          gymId: currentGym?.id || null,
          gymName: current.planType === 'multi_gym' ? 'All Partner Gyms' : (currentGym?.name || null),
          status: subscriptionStatus,
          amountPaid: Number(current.amountPaid || 0),
          startDate: current.startDate,
          endDate: current.endDate,
        } : null,
      };
    });
    return paginatedResponse(enriched, total, p, l);
  }

  async createAdmin(data: { name?: string; email?: string; password?: string }) {
    const email = data.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email is required');
    if (!data.password || data.password.length < 6) throw new BadRequestException('Password must be at least 6 characters');
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) throw new BadRequestException('An account with this email already exists');
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.repo.save(this.repo.create({
      email,
      passwordHash,
      name: data.name?.trim() || email,
      role: 'super_admin',
      isActive: true,
    }));
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async update(id: string, data: Partial<UserEntity>) {
    await this.repo.update(id, { name: data.name, email: data.email, dob: data.dob, gender: data.gender });
    return this.me(id);
  }

  async suspend(id: string) {
    await this.repo.update(id, { isActive: false } as any);
    return { success: true, userId: id, status: 'suspended' };
  }

  async unsuspend(id: string) {
    await this.repo.update(id, { isActive: true } as any);
    return { success: true, userId: id, status: 'active' };
  }

  async getReferralCode(userId: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (!user.referralCode) {
      let code = generateCode();
      // Ensure unique
      const existing = await this.repo.findOne({ where: { referralCode: code } });
      if (existing) code = generateCode() + userId.slice(0, 3).toUpperCase();
      await this.repo.update(userId, { referralCode: code });
      user.referralCode = code;
    }
    // Count referrals
    const referralCount = await this.repo.count({ where: { referredBy: user.referralCode } });
    return {
      code: user.referralCode,
      referralLink: `https://bookmyfit.in/signup?ref=${user.referralCode}`,
      totalReferrals: referralCount,
      pointsEarned: referralCount * 200,
      pointsBalance: user.loyaltyPoints || 0,
    };
  }

  async applyReferral(userId: string, code: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.referredBy) throw new Error('You have already used a referral code');
    const referrer = await this.repo.findOne({ where: { referralCode: code } });
    if (!referrer) throw new Error('Invalid referral code');
    if (referrer.id === userId) throw new Error('You cannot use your own referral code');
    // Award points to both
    await this.repo.update(userId, { referredBy: code, loyaltyPoints: (user.loyaltyPoints || 0) + 100 });
    await this.repo.update(referrer.id, { loyaltyPoints: (referrer.loyaltyPoints || 0) + 200 });
    return { success: true, message: 'Referral applied! You earned 100 loyalty points.' };
  }

  async getLoyaltyPoints(userId: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    return {
      points: user?.loyaltyPoints || 0,
      value: ((user?.loyaltyPoints || 0) * 0.1).toFixed(2), // 1 point = ₹0.10
      history: [
        { action: 'Signup Bonus', points: 50, date: user?.createdAt },
      ],
    };
  }
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
class UsersController {
  constructor(private readonly svc: UsersService) {}
  @Get('me') me(@Req() req: any) { return this.svc.me(req.user.userId); }

  @Put('me') update(@Req() req: any, @Body() body: UpdateUserDto) {
    return this.svc.update(req.user.userId, body);
  }

  @Get('me/referral') referralCode(@Req() req: any) { return this.svc.getReferralCode(req.user.userId); }

  @Post('me/referral/apply') applyReferral(@Req() req: any, @Body() body: { code: string }) {
    return this.svc.applyReferral(req.user.userId, body.code);
  }

  @Get('me/loyalty') loyalty(@Req() req: any) { return this.svc.getLoyaltyPoints(req.user.userId); }

  @Get() @UseGuards(RolesGuard) @Roles('super_admin')
  list(@Query('page') page = 1, @Query('limit') limit = 20, @Query('search') search?: string, @Query('role') role?: UserRole) {
    return this.svc.list(+page, +limit, search, role);
  }

  @Post('admins') @UseGuards(RolesGuard) @Roles('super_admin')
  createAdmin(@Body() body: { name?: string; email?: string; password?: string }) {
    return this.svc.createAdmin(body);
  }

  @Post(':id/suspend') @UseGuards(RolesGuard) @Roles('super_admin')
  suspend(@Param('id') id: string) { return this.svc.suspend(id); }

  @Post(':id/unsuspend') @UseGuards(RolesGuard) @Roles('super_admin')
  unsuspend(@Param('id') id: string) { return this.svc.unsuspend(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, SubscriptionEntity, GymEntity])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
