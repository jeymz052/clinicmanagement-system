import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { listOnlinePayments } from "@/src/lib/services/payment";

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const url = new URL(req.url);
    const appointmentIds = url.searchParams.getAll("appointment_id");
    const payments = await listOnlinePayments(actor, appointmentIds.length > 0 ? appointmentIds : undefined);
    return ok({ payments });
  } catch (e) {
    return httpError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = (await req.json()) as { payment_id?: string; status?: "Paid" | "Failed" };
    if (!body.payment_id) throw new HttpError(400, "payment_id required");
    if (body.status !== "Paid" && body.status !== "Failed") {
      throw new HttpError(400, "status must be Paid or Failed");
    }

    const { setPaymentStatusById } = await import("@/src/lib/services/payment");
    const result = await setPaymentStatusById(body.payment_id, body.status, actor);
    return ok(result);
  } catch (e) {
    return httpError(e);
  }
}
