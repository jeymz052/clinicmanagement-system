import { httpError, ok, requireActor } from "@/src/lib/http";
import { completeConsultation } from "@/src/lib/services/booking";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const appt = await completeConsultation(id, actor);
    return ok({ appointment: appt });
  } catch (e) {
    return httpError(e);
  }
}
