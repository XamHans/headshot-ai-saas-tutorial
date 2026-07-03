import { and, desc, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import type { ServiceContext } from '@/lib/services/context';
import { getServiceContext } from '@/lib/services';
import type { Result } from '@/lib/result';
import { payments, webhookEvents } from '../schema';
import type { CreatePaymentInput, NewPayment, Payment, PaymentFilters } from '../types';

/**
 * PaymentService - Handles all payment operations via Stripe
 */
export class PaymentService {
  private stripe: Stripe | null;

  constructor(private ctx: ServiceContext) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    this.stripe = secretKey
      ? new Stripe(secretKey, {
        apiVersion: '2023-10-16',
      })
      : null;
  }

  private get logger() {
    return this.ctx.logger.child({ service: 'PaymentService' });
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe secret key is not configured');
    }

    return this.stripe;
  }

  private parseAmountToMinorUnits(amount: string): number {
    const parsed = Number.parseFloat(amount);
    const minorUnits = Math.round(parsed * 100);

    if (!Number.isFinite(minorUnits) || minorUnits <= 0) {
      throw new Error('Invalid amount value');
    }

    return minorUnits;
  }

  private buildStripeMetadata(
    metadata: CreatePaymentInput['metadata'],
    extras: Record<string, string>,
  ): Record<string, string> {
    return {
      ...extras,
      ...(metadata
        ? Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [
            key,
            value == null ? '' : String(value),
          ]),
        )
        : undefined),
    };
  }

  /**
   * Create a new payment via Stripe Checkout
   * @param data Payment creation input
   * @param userId ID of the user creating the payment
   * @returns Result<Payment>
   */
  async createPayment(data: CreatePaymentInput, userId: string): Promise<Result<Payment>> {
    this.logger.info('Creating Stripe payment', {
      userId,
      amount: data.amount,
      currency: data.currency,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'NEXT_PUBLIC_APP_URL is not configured' },
      };
    }

    if (!this.stripe) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Stripe secret key is not configured' },
      };
    }
    const stripe = this.stripe;

    let amountInMinorUnits: number;
    try {
      amountInMinorUnits = this.parseAmountToMinorUnits(data.amount);
    } catch (e) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid amount value' },
      };
    }

    const paymentId = crypto.randomUUID();
    const metadata = this.buildStripeMetadata(data.metadata, {
      paymentId,
      userId,
    });

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: data.currency.toLowerCase(),
              product_data: {
                name: data.description,
              },
              unit_amount: amountInMinorUnits,
            },
            quantity: 1,
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${appUrl}/payments/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/payments/return?canceled=true`,
      });

      const [payment] = await this.ctx.db
        .insert(payments)
        .values({
          id: paymentId,
          stripeCheckoutSessionId: session.id,
          stripeCheckoutUrl: session.url,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          status: session.payment_status || session.status || 'open',
          userId,
          metadata: data.metadata,
          expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
        })
        .returning();

      this.logger.info('Payment created successfully', {
        paymentId: payment.id,
        stripeCheckoutSessionId: session.id,
      });

      return { success: true, data: payment };
    } catch (error) {
      this.logger.error('Failed to create payment', {
        error: error instanceof Error ? error : new Error(String(error)),
        userId,
      });
      return {
        success: false,
        error: {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: 'Failed to create payment',
          cause: error,
        },
      };
    }
  }

  /**
   * Get payment by internal ID
   * @param id Internal payment ID (UUID)
   * @returns Payment record or undefined if not found
   */
  async getPaymentById(id: string): Promise<Result<Payment>> {
    this.logger.debug('Fetching payment by ID', { operation: 'getPaymentById', paymentId: id });

    const [payment] = await this.ctx.db.select().from(payments).where(eq(payments.id, id));

    if (!payment) {
      return {
        success: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' },
      };
    }

    return { success: true, data: payment };
  }

  /**
   * Get payment by Stripe Payment Intent ID
   */
  async getPaymentByStripeIntentId(stripePaymentIntentId: string): Promise<Payment | undefined> {
    this.logger.debug('Fetching payment by Stripe intent ID', { stripePaymentIntentId });

    const [payment] = await this.ctx.db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, stripePaymentIntentId));

    return payment;
  }

  /**
   * Get payment by Stripe Checkout Session ID
   */
  async getPaymentByStripeSessionId(stripeCheckoutSessionId: string): Promise<Payment | undefined> {
    this.logger.debug('Fetching payment by Stripe session ID', { stripeCheckoutSessionId });

    const [payment] = await this.ctx.db
      .select()
      .from(payments)
      .where(eq(payments.stripeCheckoutSessionId, stripeCheckoutSessionId));

    return payment;
  }

  /**
   * Update payment status based on Stripe webhook payload
   */
  async updatePaymentStatus(options: {
    paymentId?: string;
    stripePaymentIntentId?: string;
    stripeCheckoutSessionId?: string;
  }): Promise<Payment> {
    const { paymentId, stripePaymentIntentId, stripeCheckoutSessionId } = options;
    this.logger.info('Updating payment status', {
      paymentId,
      stripePaymentIntentId,
      stripeCheckoutSessionId,
    });

    if (!paymentId && !stripePaymentIntentId && !stripeCheckoutSessionId) {
      throw new Error('Missing Stripe identifiers to update payment status');
    }

    try {
      const stripe = this.requireStripe();

      let sessionId = stripeCheckoutSessionId;
      let intentId = stripePaymentIntentId;

      let session: Stripe.Checkout.Session | null = null;
      let intent: Stripe.PaymentIntent | null = null;

      if (sessionId) {
        session = await stripe.checkout.sessions.retrieve(sessionId);
        if (!intentId && session.payment_intent) {
          intentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent.id;
        }
      }

      if (intentId) {
        intent = await stripe.paymentIntents.retrieve(intentId, {
          expand: ['latest_charge'],
        });
      }

      const status =
        intent?.status || session?.payment_status || session?.status || 'requires_payment_method';

      const paidAt =
        intent?.status === 'succeeded'
          ? new Date(
            ((intent.latest_charge && typeof intent.latest_charge !== 'string'
              ? intent.latest_charge.created
              : intent.created) ?? intent.created) * 1000,
          )
          : null;

      const failedAt =
        intent?.status === 'canceled' || intent?.status === 'requires_payment_method'
          ? intent?.canceled_at
            ? new Date(intent.canceled_at * 1000)
            : new Date()
          : null;

      const expiresAt =
        session?.expires_at !== undefined && session?.expires_at !== null
          ? new Date(session.expires_at * 1000)
          : undefined;

      const updateData: Partial<NewPayment> = {
        stripePaymentIntentId: intentId ?? null,
        status,
        paidAt,
        failedAt,
        updatedAt: new Date(),
      };

      if (session?.url) {
        updateData.stripeCheckoutUrl = session.url;
      }

      if (session?.id) {
        updateData.stripeCheckoutSessionId = session.id;
      } else if (sessionId) {
        updateData.stripeCheckoutSessionId = sessionId;
      }

      if (expiresAt !== undefined) {
        updateData.expiresAt = expiresAt;
      }

      const [payment] = await this.ctx.db
        .update(payments)
        .set(updateData)
        .where(
          paymentId
            ? eq(payments.id, paymentId)
            : intentId
              ? eq(payments.stripePaymentIntentId, intentId)
              : eq(payments.stripeCheckoutSessionId, sessionId!),
        )
        .returning();

      if (!payment) {
        throw new Error('Payment not found for provided Stripe identifiers');
      }

      this.logger.info('Payment status updated', {
        paymentId: payment.id,
        status,
      });

      return payment;
    } catch (error) {
      this.logger.error('Failed to update payment status', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          paymentId,
          stripePaymentIntentId,
          stripeCheckoutSessionId,
        },
      });
      throw error;
    }
  }

  /**
   * Get user payments with filters
   * @param filters Filtering options (userId, status, limit, offset)
   * @returns Array of payment records
   */
  async getUserPayments(filters: PaymentFilters): Promise<Result<Payment[]>> {
    const { userId, status, limit = 20, offset = 0 } = filters;

    this.logger.debug('Fetching user payments', {
      operation: 'getUserPayments',
      userId,
      status,
      limit,
      offset,
    });

    try {
      const result = await this.ctx.db
        .select()
        .from(payments)
        .where(
          and(
            userId ? eq(payments.userId, userId) : undefined,
            status ? eq(payments.status, status) : undefined,
          ),
        )
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset);

      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to fetch user payments', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: { operation: 'getUserPayments', userId, status },
      });
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch payments', cause: error },
      };
    }
  }

  /**
   * Record webhook event for audit trail
   */
  async recordWebhookEvent(
    paymentId: string,
    stripePaymentIntentId: string | null,
    stripeCheckoutSessionId: string,
    eventType: string,
    status: string,
    payload: unknown,
  ): Promise<void> {
    this.logger.debug('Recording webhook event', {
      paymentId,
      stripePaymentIntentId,
      stripeCheckoutSessionId,
      eventType,
      status,
    });

    await this.ctx.db.insert(webhookEvents).values({
      paymentId,
      stripePaymentIntentId,
      stripeCheckoutSessionId,
      eventType,
      status,
      payload,
    });
  }
}

/**
 * Factory function to create a PaymentService instance.
 * Use this in tests to inject test database context.
 */
export function createPaymentService(ctx: ServiceContext): PaymentService {
  return new PaymentService(ctx);
}

/**
 * Singleton instance for production use.
 * Import this directly in API routes.
 */
export const paymentService = new PaymentService(getServiceContext());
