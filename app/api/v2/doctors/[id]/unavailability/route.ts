import { HttpError, httpError, ok, requireActor, isStaff } from "@/src/lib/http";
import { addUnavailability, deleteUnavailability } from "@/src/lib/services/schedule";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("doctor_unavailability")
      .select("*")
      .eq("doctor_id", id)
      .order("starts_at");
    if (error) throw error;
    return ok({ unavailability: data ?? [] });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const allowed = isStaff(actor.profile.role) || (actor.profile.role === "doctor" && actor.id === id);
    if (!allowed) throw new HttpError(403, "Forbidden");

    const body = await req.json();
    const block = await addUnavailability({ ...body, doctor_id: id });
    return ok({ unavailability: block }, 201);
  } catch (e) {
    return httpError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const allowed = isStaff(actor.profile.role) || (actor.profile.role === "doctor" && actor.id === id);
    if (!allowed) throw new HttpError(403, "Forbidden");

    const url = new URL(req.url);
    const blockId = url.searchParams.get("block_id");
    if (!blockId) throw new HttpError(400, "block_id required");
    await deleteUnavailability(blockId);
    return ok({ ok: true });
  } catch (e) {
    return httpError(e);
  }
}
