import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { voidBilling } from "@/src/lib/services/billing";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    if (!body.reason || typeof body.reason !== "string") {
      throw new HttpError(400, "reason required");
    }
    const result = await voidBilling(id, body.reason, actor);
    return ok(result);
  } catch (e) {
    return httpError(e);
  }
}
