import { HttpError, httpError, ok, requireActor, isStaff } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { isProtectedSuperAdminEmail } from "@/src/lib/auth/protected-accounts";

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor")
      throw new HttpError(403, "Forbidden");

    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const search = url.searchParams.get("q");
    let q = supabase
      .from("patients")
      .select("*, profiles!inner(id, full_name, email, phone, is_active, role)")
      .eq("profiles.role", "patient");
    if (search) q = q.ilike("profiles.full_name", `%${search}%`);
    const { data, error } = await q.limit(100);
    if (error) throw error;
    return ok({ patients: data ?? [] });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    if (!isStaff(actor.profile.role)) throw new HttpError(403, "Forbidden");

    const body = await req.json();
    if (!body.email || !body.full_name)
      throw new HttpError(400, "email and full_name required");
    if (isProtectedSuperAdminEmail(body.email)) {
      throw new HttpError(400, "This email is reserved for the super admin account.");
    }

    const supabase = getSupabaseAdmin();

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      phone: body.phone,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
      app_metadata: { role: "patient" },
    });
    if (authError || !authUser.user) throw new HttpError(400, authError?.message ?? "Unable to create user");

    // Triggers: auth.users -> profiles -> patients. Update patient details.
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ full_name: body.full_name, phone: body.phone ?? null, role: "patient" })
      .eq("id", authUser.user.id);
    if (profErr) throw profErr;

    const { data: patient, error: patErr } = await supabase
      .from("patients")
      .upsert({
        id: authUser.user.id,
        dob: body.dob ?? null,
        gender: body.gender ?? null,
        address: body.address ?? null,
      })
      .select()
      .single();
    if (patErr) throw patErr;

    return ok({ user_id: authUser.user.id, patient }, 201);
  } catch (e) {
    return httpError(e);
  }
}
