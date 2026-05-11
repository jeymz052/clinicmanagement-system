import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
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

type UpdateMeBody = {
  full_name?: string;
  phone?: string | null;
};

export async function PATCH(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = (await req.json()) as UpdateMeBody;

    if (!body || typeof body !== "object") {
      throw new HttpError(400, "Invalid payload.");
    }

    const updates: Record<string, string | null> = {};

    if (body.full_name != null) {
      const fullName = body.full_name.trim();
      if (!fullName) throw new HttpError(400, "Full name is required.");
      if (fullName.length > 120) throw new HttpError(400, "Full name is too long.");
      updates.full_name = fullName;
    }

    if ("phone" in body) {
      const phone = body.phone?.trim() ?? "";
      if (phone.length > 30) throw new HttpError(400, "Phone number is too long.");
      updates.phone = phone || null;
    }

    if (Object.keys(updates).length === 0) {
      throw new HttpError(400, "Nothing to update.");
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", actor.id)
      .select("*")
      .single();

    if (error) throw error;

    if (updates.full_name) {
      await supabase.auth.admin.updateUserById(actor.id, {
        user_metadata: { full_name: updates.full_name },
      });
    }

    return ok({ profile: data });
  } catch (e) {
    return httpError(e);
  }
}
