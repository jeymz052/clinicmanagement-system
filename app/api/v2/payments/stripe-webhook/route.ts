import { httpError, ok } from "@/src/lib/http";
import {
  confirmPaymentByRef,
  failPaymentByRef,
} from "@/src/lib/services/payment";
import { verifyStripeSignature } from "@/src/lib/services/stripe";

/**
 * POST /api/v2/payments/stripe-webhook
 * Configure this URL in Stripe Dashboard → Developers → Webhooks.
 * Subscribe to:
 *   - checkout.session.completed
 *   - checkout.session.async_payment_succeeded
 *   - checkout.session.async_payment_failed
 *   - checkout.session.expired
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const event = await verifyStripeSignature(raw, req.headers.get("stripe-signature"));
    const type = (event as { type: string }).type;
    const sessionId = (event as { data: { object: { id: string } } }).data.object.id;

    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const result = await confirmPaymentByRef("stripe", sessionId);
      return ok({ received: true, ...result });
    }
    if (type === "checkout.session.async_payment_failed" || type === "checkout.session.expired") {
      const payment = await failPaymentByRef("stripe", sessionId);
      return ok({ received: true, payment });
    }
    return ok({ received: true, ignored: true, type });
  } catch (e) {
    return httpError(e);
  }
}
