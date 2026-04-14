import { HttpError, httpError, ok, requireActor, isStaff } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    if (!isStaff(actor.profile.role)) throw new HttpError(403, "Forbidden");
    const { id } = await params;
    const body = await req.json();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pricing")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return ok({ pricing: data });
  } catch (e) {
    return httpError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    if (!isStaff(actor.profile.role)) throw new HttpError(403, "Forbidden");
    const { id } = await params;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("pricing").update({ is_active: false }).eq("id", id);
    if (error) throw error;
    return ok({ ok: true });
  } catch (e) {
    return httpError(e);
  }
}
