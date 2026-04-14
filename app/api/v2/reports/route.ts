import { HttpError, httpError, ok, requireActor, isStaff } from "@/src/lib/http";
import {
  getNoShowRates,
  getPatientVolume,
  getPeakHours,
  getRevenue,
} from "@/src/lib/services/reports";

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor")
      throw new HttpError(403, "Forbidden");

    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;

    switch (kind) {
      case "revenue":
        return ok({ revenue: await getRevenue(from, to) });
      case "no-show":
        return ok({ no_show: await getNoShowRates() });
      case "peak-hours":
        return ok({ peak_hours: await getPeakHours() });
      case "patient-volume":
        return ok({ volume: await getPatientVolume(from, to) });
      default:
        return ok({
          revenue: await getRevenue(from, to),
          no_show: await getNoShowRates(),
          peak_hours: await getPeakHours(),
          volume: await getPatientVolume(from, to),
        });
    }
  } catch (e) {
    return httpError(e);
  }
}
