import { HttpError, httpError, ok, requireRole } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { DbRole } from "@/src/lib/db/types";

type UpdateUserBody = {
  full_name?: string;
  phone?: string | null;
  role?: DbRole; // super_admin|secretary|doctor|patient|admin
  is_active?: boolean;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(req, ["super_admin"]);
    const { id } = await ctx.params;
    if (!id) throw new HttpError(400, "Missing user id");

    const body = (await req.json()) as UpdateUserBody;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid payload");

    const updates: Record<string, unknown> = {};
    if (body.full_name != null) updates.full_name = body.full_name;
    if ("phone" in body) updates.phone = body.phone ?? null;
    if (body.role != null) updates.role = body.role;
    if (body.is_active != null) updates.is_active = body.is_active;

    if (Object.keys(updates).length === 0) {
      throw new HttpError(400, "No updates provided");
    }

    const supabase = getSupabaseAdmin();

    // Prevent locking yourself out accidentally
    if (actor.id === id && updates.is_active === false) {
      throw new HttpError(400, "You cannot deactivate your own account.");
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    // If role is changed, keep auth.app_metadata.role in sync (trusted role source).
    if (body.role) {
      await supabase.auth.admin.updateUserById(id, {
        app_metadata: { role: body.role },
      });
    }

    return ok({ user: data });
  } catch (e) {
    return httpError(e);
  }
}

