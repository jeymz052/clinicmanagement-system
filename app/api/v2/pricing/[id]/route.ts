import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

function canManagePricing(role: string) {
  return role === "super_admin" || role === "admin" || role === "secretary" || role === "doctor";
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    if (!canManagePricing(actor.profile.role)) {
      throw new HttpError(403, "Only clinic staff can manage pricing.");
    }
    const { id } = await params;
    const body = await req.json();
    const updates = {
      ...body,
      ...(body.price != null ? { price: Number(body.price) } : {}),
    };
    if (updates.price != null && (!Number.isFinite(updates.price) || updates.price < 0)) {
      throw new HttpError(400, "price must be a non-negative number");
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pricing")
      .update(updates)
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
    if (!canManagePricing(actor.profile.role)) {
      throw new HttpError(403, "Only clinic staff can manage pricing.");
    }
    const { id } = await params;

    const supabase = getSupabaseAdmin();
    const { data: linkedItem } = await supabase
      .from("billing_items")
      .select("id")
      .eq("pricing_id", id)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (linkedItem) {
      throw new HttpError(409, "Pricing already has billing history. Edit or deactivate it instead of deleting.");
    }

    const { error } = await supabase.from("pricing").delete().eq("id", id);
    if (error) throw error;
    return ok({ ok: true });
  } catch (e) {
    return httpError(e);
  }
}
