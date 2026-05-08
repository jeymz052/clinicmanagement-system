import { httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

/**
 * Public-ish clinic header for receipts and any "Bill To" / letterhead use.
 * Returns only the fields safe to expose to every authenticated role —
 * staff settings (online fee, max patients/hour, default meeting link)
 * remain behind /api/settings.
 *
 * GET   — any authenticated user (patient, doctor, secretary, admin).
 * PATCH — super_admin or doctor; same gate as /api/settings, just narrower
 *         in scope so we don't accidentally expose other settings here.
 */

type ClinicInfoRow = {
  clinic_name: string;
  email: string;
  phone: string;
  address: string;
};

type ClinicInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

function rowToInfo(row: ClinicInfoRow | null): ClinicInfo {
  return {
    name: row?.clinic_name ?? "",
    email: row?.email ?? "",
    phone: row?.phone ?? "",
    address: row?.address ?? "",
  };
}

export async function GET(req: Request) {
  try {
    await requireActor(req);
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("system_settings")
      .select("clinic_name,email,phone,address")
      .eq("id", true)
      .maybeSingle<ClinicInfoRow>();
    return ok({ clinic: rowToInfo(data ?? null) });
  } catch (e) {
    return httpError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requireActor(req);
    if (actor.profile.role !== "super_admin" && actor.profile.role !== "doctor") {
      return ok({ message: "Only the clinic admin or doctor can edit clinic info." }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Partial<{
      name: string;
      address: string;
      phone: string;
      email: string;
    }>;

    // Only the four fields we expose are accepted; everything else stays in
    // the existing /api/settings flow.
    const patch: Partial<ClinicInfoRow> = {};
    if (typeof body.name === "string") patch.clinic_name = body.name.trim();
    if (typeof body.address === "string") patch.address = body.address.trim();
    if (typeof body.phone === "string") patch.phone = body.phone.trim();
    if (typeof body.email === "string") patch.email = body.email.trim();

    if (Object.keys(patch).length === 0) {
      return ok({ message: "Nothing to update." }, 400);
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("system_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", true)
      .select("clinic_name,email,phone,address")
      .maybeSingle<ClinicInfoRow>();
    if (error) throw error;

    return ok({ clinic: rowToInfo(data ?? null) });
  } catch (e) {
    return httpError(e);
  }
}
