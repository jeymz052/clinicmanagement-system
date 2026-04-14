import { httpError, ok, requireActor } from "@/src/lib/http";
import { listAppointments, reserveAppointment } from "@/src/lib/services/booking";

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const url = new URL(req.url);
    const appointments = await listAppointments(actor, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      doctor_id: url.searchParams.get("doctor_id") ?? undefined,
      patient_id: url.searchParams.get("patient_id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return ok({ appointments });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = await req.json();
    const appt = await reserveAppointment(body, actor);
    return ok({ appointment: appt }, 201);
  } catch (e) {
    return httpError(e);
  }
}
