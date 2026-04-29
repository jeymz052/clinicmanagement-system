import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { recordBillingPayment } from "@/src/lib/services/billing";
import type { PaymentMethod } from "@/src/lib/db/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const body = (await req.json()) as { method?: PaymentMethod; provider_ref?: string | null };
    if (!body.method) throw new HttpError(400, "method required");
    const result = await recordBillingPayment(id, body.method, body.provider_ref ?? null, actor);
    return ok(result);
  } catch (e) {
    return httpError(e);
  }
}
