import { httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export async function GET(req: Request) {
  try {
    await requireActor(req);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("doctors")
      .select("id, slug, specialty, license_no, consultation_fee_clinic, consultation_fee_online, profiles!inner(full_name, email, phone, is_active)")
      .eq("profiles.is_active", true);
    if (error) throw error;
    return ok({ doctors: data ?? [] });
  } catch (e) {
    return httpError(e);
  }
}
