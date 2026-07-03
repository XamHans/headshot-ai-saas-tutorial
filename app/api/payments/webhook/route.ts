import Stripe from 'stripe';
import { withHandler } from '@/lib/api/handlers';
import { createLogger } from '@/lib/logger';
import { paymentService } from '@/modules/payments/services/payment.service';

type WebhookResult = { status: 'ok' | 'ignored'; reason?: string };

/**
 * POST /api/payments/webhook
 * Handle Stripe webhook events.
 *
 * No authentication required - validated by the Stripe signature instead.
 * Uses the raw request body for signature verification (required by Stripe).
 */
export const POST = withHandler<WebhookResult>(async (request) => {
  const logger = createLogger({ service: 'stripe-webhook' });
  logger.info('Received Stripe webhook', { operation: 'webhookHandler' });

  // Raw body is required for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured', { operation: 'webhookHandler' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Webhook secret not configured' },
    };
  }

  if (!signature) {
    logger.warn('Missing Stripe signature', { operation: 'webhookHandler' });
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing signature' },
    };
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    logger.warn('Invalid webhook signature', {
      operation: 'webhookHandler',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid signature', cause: error },
    };
  }

  logger.info('Webhook signature verified', {
    operation: 'webhookHandler',
    eventType: event.type,
    eventId: event.id,
  });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const payment = await paymentService.getPaymentByStripeSessionId(session.id);

      if (!payment) {
        logger.warn('Payment not found for checkout session', {
          operation: 'webhookHandler',
          sessionId: session.id,
        });
        return { success: true, data: { status: 'ignored', reason: 'payment_not_found' } };
      }

      const updatedPayment = await paymentService.updatePaymentStatus({
        stripeCheckoutSessionId: session.id,
      });

      await paymentService.recordWebhookEvent(
        payment.id,
        updatedPayment.stripePaymentIntentId,
        session.id,
        event.type,
        updatedPayment.status,
        event.data.object,
      );

      logger.info('Checkout session completed', {
        operation: 'webhookHandler',
        paymentId: payment.id,
        sessionId: session.id,
        status: updatedPayment.status,
      });
      break;
    }

    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const payment = await paymentService.getPaymentByStripeIntentId(paymentIntent.id);

      if (!payment) {
        logger.warn('Payment not found for payment intent', {
          operation: 'webhookHandler',
          paymentIntentId: paymentIntent.id,
        });
        return { success: true, data: { status: 'ignored', reason: 'payment_not_found' } };
      }

      const updatedPayment = await paymentService.updatePaymentStatus({
        stripePaymentIntentId: paymentIntent.id,
      });

      await paymentService.recordWebhookEvent(
        payment.id,
        paymentIntent.id,
        payment.stripeCheckoutSessionId!,
        event.type,
        updatedPayment.status,
        event.data.object,
      );

      logger.info('Payment intent succeeded', {
        operation: 'webhookHandler',
        paymentId: payment.id,
        paymentIntentId: paymentIntent.id,
      });
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const payment = await paymentService.getPaymentByStripeIntentId(paymentIntent.id);

      if (!payment) {
        return { success: true, data: { status: 'ignored', reason: 'payment_not_found' } };
      }

      const updatedPayment = await paymentService.updatePaymentStatus({
        stripePaymentIntentId: paymentIntent.id,
      });

      await paymentService.recordWebhookEvent(
        payment.id,
        paymentIntent.id,
        payment.stripeCheckoutSessionId!,
        event.type,
        updatedPayment.status,
        event.data.object,
      );

      logger.warn('Payment intent failed', {
        operation: 'webhookHandler',
        paymentId: payment.id,
        paymentIntentId: paymentIntent.id,
      });
      break;
    }

    default:
      logger.debug('Unhandled webhook event type', {
        operation: 'webhookHandler',
        eventType: event.type,
      });
      return { success: true, data: { status: 'ignored', reason: 'event_type_not_handled' } };
  }

  return { success: true, data: { status: 'ok' } };
});
