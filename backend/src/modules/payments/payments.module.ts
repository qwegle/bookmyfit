import { Module, Controller, Post, Body, Req, Headers, HttpCode, BadRequestException, Injectable, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashfreeService } from './cashfree.service';
import { SubscriptionEntity } from '../../database/entities/subscription.entity';
import { OrderEntity } from '../../database/entities/store.entity';
import { TrainerBookingEntity } from '../../database/entities/trainer.entity';
import { WellnessBookingEntity } from '../../database/entities/wellness.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Injectable()
class PaymentsService {
  constructor(
    @InjectRepository(SubscriptionEntity) private readonly subs: Repository<SubscriptionEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(TrainerBookingEntity) private readonly ptBookings: Repository<TrainerBookingEntity>,
    @InjectRepository(WellnessBookingEntity) private readonly wellnessBookings: Repository<WellnessBookingEntity>,
    private readonly cashfree: CashfreeService,
  ) {}

  private activeGymPass(userId: string, gymId?: string, excludeId?: string) {
    if (!gymId) return Promise.resolve(null);
    const qb = this.subs.createQueryBuilder('s')
      .select('s.id', 'id')
      .addSelect('s."endDate"', 'endDate')
      .where('s."userId" = :userId', { userId })
      .andWhere('s.status = :status', { status: 'active' })
      .andWhere('s."planType" IN (:...planTypes)', { planTypes: ['same_gym', 'day_pass'] })
      .andWhere(':gymId = ANY(s."gymIds")', { gymId })
      .andWhere('s."endDate" >= CURRENT_DATE');

    if (excludeId) qb.andWhere('s.id != :excludeId', { excludeId });
    return qb.getRawOne();
  }

  private async applyOrderStatus(orderId: string, status?: string, paymentId?: string, event?: string) {
    if (!orderId) return { processed: false, reason: 'No order_id' };

    // Try each entity type in turn
    const [sub, order, pt, wellness] = await Promise.all([
      this.subs.findOne({ where: { razorpayOrderId: orderId } }), // legacy column now stores cashfree id too
      this.orders.findOne({ where: { cashfreeOrderId: orderId } }),
      this.ptBookings.findOne({ where: { cashfreeOrderId: orderId } }),
      this.wellnessBookings.findOne({ where: { cashfreeOrderId: orderId } }),
    ]);

    const paid = status === 'PAID';

    if (sub) {
      if (paid && (sub.planType === 'same_gym' || sub.planType === 'day_pass') && sub.gymIds?.[0]) {
        const duplicate = await this.activeGymPass(sub.userId, sub.gymIds[0], sub.id);
        if (duplicate) {
          sub.razorpayPaymentId = paymentId || sub.razorpayPaymentId;
          await this.subs.save(sub);
          return { processed: true, kind: 'subscription', paid, activated: false, reason: 'duplicate_active_gym_pass' };
        }
      }
      sub.status = paid ? 'active' : sub.status;
      sub.razorpayPaymentId = paymentId || sub.razorpayPaymentId;
      await this.subs.save(sub);
      return { processed: true, kind: 'subscription', paid, activated: paid };
    }
    if (order) {
      order.status = paid ? 'paid' : 'cancelled';
      await this.orders.save(order);
      return { processed: true, kind: 'order', paid };
    }
    if (pt) {
      pt.status = paid ? 'confirmed' : 'cancelled';
      await this.ptBookings.save(pt);
      return { processed: true, kind: 'pt', paid };
    }
    if (wellness) {
      wellness.status = paid ? 'confirmed' : 'cancelled';
      await this.wellnessBookings.save(wellness);
      return { processed: true, kind: 'wellness', paid };
    }

    return { processed: false, reason: 'No matching order', event };
  }

  /**
   * Called by Cashfree on payment events.
   * We look up the reference entity by cashfreeOrderId and mark it paid/active.
   */
  async handleWebhook(rawBody: string, payload: any) {
    const event = payload?.type;
    const orderId: string | undefined = payload?.data?.order?.order_id;
    const status: string | undefined = payload?.data?.order?.order_status;
    const paymentId: string | undefined = payload?.data?.payment?.cf_payment_id;
    return this.applyOrderStatus(orderId || '', status, paymentId, event);
  }

  async verifyOrder(orderId: string) {
    const cfOrder = await this.cashfree.fetchOrder(orderId);
    const status = cfOrder?.order_status;
    if (!status) throw new BadRequestException('Unable to verify payment status');
    const processed = await this.applyOrderStatus(orderId, status, cfOrder?.cf_payment_id);
    return { ...processed, orderId, paymentStatus: status, paid: status === 'PAID' };
  }
}

@ApiTags('Payments')
@Controller('payments')
class PaymentsController {
  constructor(private readonly svc: PaymentsService, private readonly cashfree: CashfreeService) {}

  @Post('cashfree/order')
  @ApiOperation({ summary: 'Create a Cashfree order (returns payment_session_id for SDK)' })
  async createOrder(@Body() body: {
    orderId: string; amount: number; customerId: string; customerPhone: string;
    customerEmail?: string; returnUrl?: string; notes?: any;
  }) {
    return this.cashfree.createOrder(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify/:orderId')
  @ApiOperation({ summary: 'Verify a Cashfree order and update matching BookMyFit record' })
  verifyOrder(@Param('orderId') orderId: string) {
    return this.svc.verifyOrder(orderId);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cashfree webhook endpoint' })
  async webhook(
    @Req() req: any,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-webhook-timestamp') timestamp: string,
    @Body() body: any,
  ) {
    const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : JSON.stringify(body);
    if (process.env.NODE_ENV === 'production' && (!signature || !timestamp)) {
      throw new BadRequestException('Missing webhook signature');
    }

    if (signature && timestamp) {
      const ok = this.cashfree.verifyWebhookSignature(raw, timestamp, signature);
      if (!ok && process.env.NODE_ENV === 'production') {
        throw new BadRequestException('Invalid webhook signature');
      }
    }
    return this.svc.handleWebhook(raw, body);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionEntity, OrderEntity, TrainerBookingEntity, WellnessBookingEntity])],
  controllers: [PaymentsController],
  providers: [PaymentsService, CashfreeService],
  exports: [CashfreeService, PaymentsService],
})
export class PaymentsModule {}
