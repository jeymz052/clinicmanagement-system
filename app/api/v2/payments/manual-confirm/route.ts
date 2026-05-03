import { httpError, ok, requireRole, STAFF_ROLES } from "@/src/lib/http";
import { confirmManualBankTransferReservation } from "@/src/lib/services/payment";

type ManualConfirmBody = {
  reservation_id?: string;
};

export async function POST(req: Request) {
  try {
    const actor = await requireRole(req, STAFF_ROLES);
    const body = (await req.json()) as ManualConfirmBody;

    if (!body.reservation_id) {
      return ok({ message: "reservation_id is required" }, 400);
    }

    const result = await confirmManualBankTransferReservation(body.reservation_id, actor);
    return ok({
      message: "Bank transfer marked as paid and appointment confirmed.",
      appointment: result.appointment,
      payment: result.payment,
    });
  } catch (e) {
    return httpError(e);
  }
}
