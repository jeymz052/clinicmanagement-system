import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import {
  approveAppointment,
  canReadAppointment,
  cancelAppointment,
  getAppointment,
} from "@/src/lib/services/booking";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const appt = await getAppointment(id);
    if (!canReadAppointment(appt, actor)) throw new HttpError(403, "Forbidden");
    return ok({ appointment: appt });
  } catch (e) {
    return httpError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const appt = await cancelAppointment(id, actor);
    return ok({ appointment: appt });
  } catch (e) {
    return httpError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const body = (await req.json()) as { action?: string };
    if (body.action !== "approve") throw new HttpError(400, "Unsupported action");
    const appt = await approveAppointment(id, actor);
    return ok({ appointment: appt });
  } catch (e) {
    return httpError(e);
  }
}
