import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

function canManageConsultationFees(role: string) {
  return role === "super_admin" || role === "admin" || role === "secretary" || role === "doctor";
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    if (!canManageConsultationFees(actor.profile.role)) {
      throw new HttpError(403, "Only clinic staff can update consultation fees.");
    }

    const { id } = await params;
    const body = (await req.json()) as {
      consultation_fee_clinic?: number;
      consultation_fee_online?: number;
    };

    const clinicFee = Number(body.consultation_fee_clinic);
    const onlineFee = Number(body.consultation_fee_online);
    if (!Number.isFinite(clinicFee) || clinicFee < 0) {
      throw new HttpError(400, "consultation_fee_clinic must be a non-negative number");
    }
    if (!Number.isFinite(onlineFee) || onlineFee < 0) {
      throw new HttpError(400, "consultation_fee_online must be a non-negative number");
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("doctors")
      .update({
        consultation_fee_clinic: clinicFee,
        consultation_fee_online: onlineFee,
      })
      .eq("id", id)
      .select("id, specialty, license_no, consultation_fee_clinic, consultation_fee_online")
      .single();
    if (error) throw error;

    return ok({ doctor: data });
  } catch (e) {
    return httpError(e);
  }
}
