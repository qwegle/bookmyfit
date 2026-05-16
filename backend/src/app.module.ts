import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GymsModule } from './modules/gyms/gyms.module';
import { GymPlansModule } from './modules/gym-plans/gym-plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { CheckinsModule } from './modules/checkins/checkins.module';
import { QrModule } from './modules/qr/qr.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { CorporateModule } from './modules/corporate/corporate.module';
import { HealthModule } from './modules/health/health.module';
import { RedisModule } from './common/redis/redis.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TrainersModule } from './modules/trainers/trainers.module';
import { WellnessModule } from './modules/wellness/wellness.module';
import { StoreModule } from './modules/store/store.module';
import { MiscModule } from './modules/misc/misc.module';
import { SlotsModule } from './modules/slots/slots.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { EmailModule } from './modules/email/email.module';
import { GymScheduleEntity } from './database/entities/gym-schedule.entity';
import { SessionTypeEntity } from './database/entities/session-type.entity';
import { SessionScheduleEntity } from './database/entities/session-schedule.entity';
import { SessionSlotEntity } from './database/entities/session-slot.entity';
import { SessionBookingEntity } from './database/entities/session-booking.entity';
import { AttendanceEntity } from './database/entities/attendance.entity';
import { SeedService } from './database/seed.service';
import { UserEntity } from './database/entities/user.entity';
import { GymEntity, MultiGymNetworkEntity } from './database/entities/gym.entity';
import { ProductEntity } from './database/entities/store.entity';
import { CorporateAccountEntity } from './database/entities/corporate.entity';
import { CategoryEntity, WorkoutVideoEntity } from './database/entities/misc.entity';
import { GymSlotEntity } from './database/entities/gym-slot.entity';
import { SlotBookingEntity } from './database/entities/slot-booking.entity';
import { AppConfigEntity } from './database/entities/app-config.entity';
import { WellnessPartnerEntity, WellnessServiceEntity } from './database/entities/wellness.entity';

@Module({
  providers: [SeedService],
  imports: [
    TypeOrmModule.forFeature([UserEntity, GymEntity, MultiGymNetworkEntity, ProductEntity, CorporateAccountEntity, WorkoutVideoEntity, CategoryEntity, GymSlotEntity, SlotBookingEntity, AppConfigEntity, GymScheduleEntity, SessionTypeEntity, SessionScheduleEntity, SessionSlotEntity, SessionBookingEntity, AttendanceEntity, WellnessPartnerEntity, WellnessServiceEntity]),
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            ssl: { rejectUnauthorized: false },
            autoLoadEntities: true,
            synchronize: process.env.NODE_ENV !== 'production',
            logging: false,
          };
        }
        return {
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_DATABASE || 'bookmyfit',
          autoLoadEntities: true,
          synchronize: process.env.NODE_ENV !== 'production',
          logging: false,
        };
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    RedisModule,
    AuthModule,
    UsersModule,
    GymsModule,
    GymPlansModule,
    SubscriptionsModule,
    CheckinsModule,
    QrModule,
    SettlementsModule,
    CorporateModule,
    PaymentsModule,
    TrainersModule,
    WellnessModule,
    StoreModule,
    MiscModule,
    SlotsModule,
    SessionsModule,
    EmailModule,
    HealthModule,
  ],
})
export class AppModule {}
