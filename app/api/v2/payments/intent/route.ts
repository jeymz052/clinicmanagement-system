import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { createPaymentIntent } from "@/src/lib/services/payment";
import type { PaymentMethod } from "@/src/lib/db/types";

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = (await req.json()) as {
      appointment_id?: string;
      method?: PaymentMethod;
    };
    if (!body.appointment_id) throw new HttpError(400, "appointment_id required");
    if (!body.method) throw new HttpError(400, "method required");

    const payment = await createPaymentIntent(body.appointment_id, body.method, actor);
    return ok({ payment }, 201);
  } catch (e) {
    return httpError(e);
  }
}
