import { httpError, ok, requireActor } from "@/src/lib/http";
import { getVitals, upsertVitals, type VitalSignsInput } from "@/src/lib/services/vitals";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v2/appointments/:id/vitals — returns the row or null if not yet
// recorded. Patient (own appointment), doctor (assigned), and staff can read.
export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const vitals = await getVitals(id, actor);
    return ok({ vitals });
  } catch (e) {
    return httpError(e);
  }
}

// PUT /api/v2/appointments/:id/vitals — upserts. Staff (front desk capture
// at check-in) or the assigned doctor (re-takes during consultation).
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const body = (await req.json()) as VitalSignsInput;
    const vitals = await upsertVitals(id, body, actor);
    return ok({ vitals });
  } catch (e) {
    return httpError(e);
  }
}
