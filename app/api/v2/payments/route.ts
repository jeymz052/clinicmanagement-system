import { httpError, ok, requireActor } from "@/src/lib/http";
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
