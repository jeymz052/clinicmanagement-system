import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { getAvailability, suggestNextSlot } from "@/src/lib/services/schedule";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireActor(req);
    const { id } = await params;
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    if (!date) throw new HttpError(400, "date query parameter required (YYYY-MM-DD)");
    const slots = await getAvailability(id, date);
    return ok({ slots, next: suggestNextSlot(slots) });
  } catch (e) {
    return httpError(e);
  }
}
