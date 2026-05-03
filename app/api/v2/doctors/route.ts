import { httpError, ok, requireActor } from "@/src/lib/http";
import { normalizeConfiguredConsultationRate } from "@/src/lib/consultation-pricing";
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
    return ok({
      doctors: (data ?? []).map((doctor) => ({
        ...doctor,
        consultation_fee_clinic: normalizeConfiguredConsultationRate(Number(doctor.consultation_fee_clinic ?? 0)),
        consultation_fee_online: normalizeConfiguredConsultationRate(Number(doctor.consultation_fee_online ?? 0)),
      })),
    });
  } catch (e) {
    return httpError(e);
  }
}
