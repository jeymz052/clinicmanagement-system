import { httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const supabase = getSupabaseAdmin();

    let extra: Record<string, unknown> = {};
    if (actor.profile.role === "patient") {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("id", actor.id)
        .maybeSingle();
      extra = { patient: data };
    } else if (actor.profile.role === "doctor") {
      const { data } = await supabase
        .from("doctors")
        .select("*")
        .eq("id", actor.id)
        .maybeSingle();
      extra = { doctor: data };
    }

    return ok({ profile: actor.profile, ...extra });
  } catch (e) {
    return httpError(e);
  }
}
