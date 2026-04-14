import { HttpError, httpError, ok, requireActor, isStaff } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export async function GET(req: Request) {
  try {
    await requireActor(req);
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("active") !== "false";
    let q = supabase.from("pricing").select("*").order("category").order("name");
    if (activeOnly) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) throw error;
    return ok({ pricing: data ?? [] });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    if (!isStaff(actor.profile.role)) throw new HttpError(403, "Forbidden");
    const body = await req.json();
    if (!body.code || !body.name || !body.category || body.price == null)
      throw new HttpError(400, "code, name, category, price required");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pricing")
      .insert({
        code: body.code,
        name: body.name,
        category: body.category,
        price: body.price,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();
    if (error) throw error;
    return ok({ pricing: data }, 201);
  } catch (e) {
    return httpError(e);
  }
}
