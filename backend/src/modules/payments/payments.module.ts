import { Module, Controller, Post, Body, Req, Headers, HttpCode, BadRequestException, Injectable, Param, UseGuards, Get, Query, Header } from '@nestjs/common';
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

    const normalizedStatus = String(status || '').toUpperCase();
    const paid = normalizedStatus === 'PAID';
    const failed = ['FAILED', 'CANCELLED', 'USER_DROPPED', 'EXPIRED'].includes(normalizedStatus);

    const processed: any[] = [];

    if (sub) {
      if (paid && (sub.planType === 'same_gym' || sub.planType === 'day_pass') && sub.gymIds?.[0]) {
        const duplicate = await this.activeGymPass(sub.userId, sub.gymIds[0], sub.id);
        if (duplicate) {
          sub.razorpayPaymentId = paymentId || sub.razorpayPaymentId;
          await this.subs.save(sub);
          processed.push({ kind: 'subscription', paid, activated: false, reason: 'duplicate_active_gym_pass' });
        } else {
          sub.status = 'active';
          sub.razorpayPaymentId = paymentId || sub.razorpayPaymentId;
          await this.subs.save(sub);
          processed.push({ kind: 'subscription', paid, activated: true });
        }
      } else {
        sub.status = paid ? 'active' : sub.status;
        sub.razorpayPaymentId = paymentId || sub.razorpayPaymentId;
        await this.subs.save(sub);
        processed.push({ kind: 'subscription', paid, activated: paid });
      }
    }
    if (order) {
      if (paid) order.status = 'paid';
      else if (failed && order.status !== 'paid') order.status = 'cancelled';
      await this.orders.save(order);
      processed.push({ kind: 'order', paid });
    }
    if (pt) {
      if (paid) pt.status = 'confirmed';
      else if (failed && pt.status !== 'confirmed') pt.status = 'cancelled';
      await this.ptBookings.save(pt);
      processed.push({ kind: 'pt', paid });
    }
    if (wellness) {
      if (paid) wellness.status = 'confirmed';
      else if (failed && wellness.status !== 'confirmed') wellness.status = 'cancelled';
      await this.wellnessBookings.save(wellness);
      processed.push({ kind: 'wellness', paid });
    }

    if (processed.length === 1) return { processed: true, ...processed[0] };
    if (processed.length > 1) return { processed: true, paid, results: processed };
    return { processed: false, reason: 'No matching order', event };
  }

  /**
   * Called by Cashfree on payment events.
   * We look up the reference entity by cashfreeOrderId and mark it paid/active.
   */
  async handleWebhook(rawBody: string, payload: any) {
    const event = payload?.type;
    const orderId: string | undefined = payload?.data?.order?.order_id;
    const paymentStatus = String(payload?.data?.payment?.payment_status || '').toUpperCase();
    const orderStatus = String(payload?.data?.order?.order_status || '').toUpperCase();
    const status: string | undefined = ['SUCCESS', 'PAID'].includes(paymentStatus) ? 'PAID' : (orderStatus || paymentStatus);
    const paymentId: string | undefined = payload?.data?.payment?.cf_payment_id;
    return this.applyOrderStatus(orderId || '', status, paymentId, event);
  }

  async verifyOrder(orderId: string) {
    const payment = await this.cashfree.fetchPaidStatus(orderId);
    const status = payment.orderStatus;
    if (!status) throw new BadRequestException('Unable to verify payment status');
    const processed = await this.applyOrderStatus(orderId, payment.paid ? 'PAID' : status, payment.paymentId);
    return { ...processed, orderId, paymentStatus: payment.paid ? 'PAID' : status, paid: payment.paid };
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

  @Get('return')
  @Header('Content-Type', 'text/html')
  @ApiOperation({ summary: 'Cashfree browser return URL' })
  paymentReturn(@Query('order_id') orderId = '', @Query('order_status') orderStatus = '') {
    const query = new URLSearchParams({
      order_id: orderId,
      order_status: orderStatus || 'RETURNED',
    }).toString();
    const deepLink = `bookmyfit://payment-return?${query}`;
    const message = JSON.stringify({
      type: 'PAYMENT_RETURN',
      payload: { orderId, orderStatus: orderStatus || 'RETURNED' },
    });
    return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BookMyFit Payment</title>
    <style>
      body{margin:0;min-height:100vh;background:#060606;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box}
      a{display:inline-block;margin-top:18px;color:#060606;background:#ccff00;border-radius:999px;padding:12px 18px;text-decoration:none;font-weight:700}
      p{color:rgba(255,255,255,.65);line-height:1.5}
    </style>
  </head>
  <body>
    <main>
      <h2>Confirming your payment</h2>
      <p>You can return to BookMyFit now. The app will verify this payment automatically.</p>
      <a href="${deepLink}">Return to BookMyFit</a>
    </main>
    <script>
      (function(){
        try {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(${JSON.stringify(message)});
          }
        } catch (e) {}
        setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 250);
      })();
    </script>
  </body>
</html>`;
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
