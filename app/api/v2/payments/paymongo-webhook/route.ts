import { httpError, ok } from "@/src/lib/http";
import { confirmPaymentByRef, failPaymentByRef } from "@/src/lib/services/payment";
import { verifyPayMongoSignature } from "@/src/lib/services/paymongo";

type PayMongoEvent = {
  data?: {
    attributes?: {
      type?: string;
      data?: {
        id?: string;
      };
    };
  };
};

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    verifyPayMongoSignature(raw, req.headers.get("Paymongo-Signature"));

    const event = JSON.parse(raw) as PayMongoEvent;
    const type = event.data?.attributes?.type ?? "";
    const sessionId = event.data?.attributes?.data?.id ?? "";

    if (!sessionId) return ok({ received: true, ignored: true });

    if (type === "checkout_session.payment.paid" || type === "payment.paid") {
      const result = await confirmPaymentByRef("paymongo", sessionId);
      return ok({ received: true, ...result });
    }

    if (type === "payment.failed") {
      const payment = await failPaymentByRef("paymongo", sessionId);
      return ok({ received: true, payment });
    }

    return ok({ received: true, ignored: true, type });
  } catch (e) {
    return httpError(e);
  }
}
