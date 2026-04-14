import { HttpError, httpError, ok } from "@/src/lib/http";
import {
  confirmPaymentByRef,
  failPaymentByRef,
  verifyWebhookSignature,
} from "@/src/lib/services/payment";

type WebhookBody = {
  type: "payment_succeeded" | "payment_failed";
  provider: string;
  provider_ref: string;
};

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    verifyWebhookSignature(req, rawBody);

    const event = JSON.parse(rawBody) as WebhookBody;
    if (!event.provider || !event.provider_ref)
      throw new HttpError(400, "provider and provider_ref required");

    if (event.type === "payment_succeeded") {
      const result = await confirmPaymentByRef(event.provider, event.provider_ref);
      return ok({ received: true, ...result });
    }
    if (event.type === "payment_failed") {
      const payment = await failPaymentByRef(event.provider, event.provider_ref);
      return ok({ received: true, payment });
    }
    return ok({ received: true, ignored: true });
  } catch (e) {
    return httpError(e);
  }
}
