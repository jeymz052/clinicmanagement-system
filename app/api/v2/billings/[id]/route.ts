import { httpError, ok, requireActor } from "@/src/lib/http";
import { getBilling, updateBilling } from "@/src/lib/services/billing";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const billing = await getBilling(id, actor);
    return ok({ billing });
  } catch (e) {
    return httpError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const body = await req.json();
    const billing = await updateBilling(id, body, actor);
    return ok({ billing });
  } catch (e) {
    return httpError(e);
  }
}
