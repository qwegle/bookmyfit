import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CheckinEntity } from '../../database/entities/checkin.entity';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { GymEntity } from '../../database/entities/gym.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { FraudAlertEntity } from '../../database/entities/misc.entity';
import { BookingQrEntity } from '../../database/entities/booking-qr.entity';
import { SessionBookingEntity } from '../../database/entities/session-booking.entity';
import { SessionSlotEntity } from '../../database/entities/session-slot.entity';
import { AppConfigEntity } from '../../database/entities/app-config.entity';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CheckinEntity, SubscriptionEntity, GymEntity, UserEntity, FraudAlertEntity, BookingQrEntity, SessionBookingEntity, SessionSlotEntity, AppConfigEntity]),
    JwtModule.register({
      secret: process.env.QR_SECRET || 'qr-hmac-secret-change-me',
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [QrController],
  providers: [QrService],
})
export class QrModule {}
