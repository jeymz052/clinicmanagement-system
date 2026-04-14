import { HttpError, httpError, ok, requireActor, isStaff } from "@/src/lib/http";
import { reapUnpaidOnline } from "@/src/lib/services/payment";

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    if (!isStaff(actor.profile.role)) throw new HttpError(403, "Forbidden");
    const url = new URL(req.url);
    const minutes = Number(url.searchParams.get("minutes") ?? "30");
    const cancelled = await reapUnpaidOnline(minutes);
    return ok({ cancelled });
  } catch (e) {
    return httpError(e);
  }
}
