import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Cashfree Payments v3 integration.
 * Docs: https://docs.cashfree.com/reference/pg-new-apis-endpoint
 *
 * In production, replace the mock stubs with fetch() calls to
 *   https://api.cashfree.com/pg/orders        (create)
 *   https://api.cashfree.com/pg/orders/{id}   (fetch status)
 * using x-client-id / x-client-secret / x-api-version headers.
 *
 * For sandbox: https://sandbox.cashfree.com/pg/orders
 */
@Injectable()
export class CashfreeService {
  private readonly logger = new Logger('Cashfree');
  private readonly apiBase = process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
  private readonly clientId = process.env.CASHFREE_CLIENT_ID || 'TEST_CLIENT_ID';
  private readonly clientSecret = process.env.CASHFREE_CLIENT_SECRET || 'TEST_CLIENT_SECRET';

  private get mockModeEnabled(): boolean {
    return process.env.CASHFREE_MOCK_MODE === 'true' && process.env.NODE_ENV !== 'production';
  }

  private createMockOrder(orderId: string) {
    return {
      orderId,
      paymentSessionId: `mock_session_${orderId}`,
      orderStatus: 'ACTIVE',
      mock: true,
    };
  }

  private normalizePhone(phone?: string): string {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return '9999999999';
  }

  private normalizeEmail(email: string | undefined, phone: string): string {
    const value = String(email || '').trim();
    if (value.includes('@')) return value;
    return `${phone}@bookmyfit.in`;
  }

  /**
   * Create a Cashfree order. Returns payment_session_id which the
   * mobile/web client uses with the Cashfree SDK to render the checkout.
   */
  async createOrder(params: {
    orderId: string;
    amount: number;
    customerId: string;
    customerPhone: string;
    customerEmail?: string;
    returnUrl?: string;
    notes?: Record<string, any>;
  }) {
    if (this.mockModeEnabled) return this.createMockOrder(params.orderId);
    const customerPhone = this.normalizePhone(params.customerPhone);
    const customerEmail = this.normalizeEmail(params.customerEmail, customerPhone);

    const body = {
      order_id: params.orderId,
      order_amount: params.amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: params.customerId,
        customer_phone: customerPhone,
        customer_email: customerEmail,
      },
      order_meta: {
        return_url: params.returnUrl || 'bookmyfit://payment-return?order_id={order_id}',
        notify_url: `${process.env.API_BASE_URL || 'http://localhost:3003'}/api/v1/payments/webhook`,
      },
      order_tags: params.notes || {},
    };

    try {
      const res = await fetch(`${this.apiBase}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-client-id': this.clientId,
          'x-client-secret': this.clientSecret,
        },
        body: JSON.stringify(body),
      });
      const data: any = await res.json();
      if (!res.ok) {
        this.logger.warn(`Cashfree order failed: ${JSON.stringify(data)}`);
        if (this.mockModeEnabled) return this.createMockOrder(params.orderId);
        const detail = data?.message || data?.type || data?.code || 'Cashfree order creation failed';
        throw new BadRequestException(detail);
      }
      return {
        orderId: data.order_id,
        paymentSessionId: data.payment_session_id,
        orderStatus: data.order_status,
      };
    } catch (err: any) {
      this.logger.error(`Cashfree API error: ${err.message}`);
      if (this.mockModeEnabled) return this.createMockOrder(params.orderId);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Cashfree API unavailable');
    }
  }

  async fetchOrder(orderId: string) {
    try {
      const res = await fetch(`${this.apiBase}/orders/${orderId}`, {
        headers: {
          'x-api-version': '2023-08-01',
          'x-client-id': this.clientId,
          'x-client-secret': this.clientSecret,
        },
      });
      return await res.json();
    } catch (err: any) {
      this.logger.error(`Cashfree fetch error: ${err.message}`);
      return null;
    }
  }

  /**
   * Verify webhook signature.
   * Cashfree signs with: Base64(HmacSHA256(timestamp + rawBody, clientSecret))
   */
  verifyWebhookSignature(rawBody: string, timestamp: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.clientSecret)
      .update(timestamp + rawBody)
      .digest('base64');
    return expected === signature;
  }
}
