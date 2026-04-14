import { httpError, ok, requireActor } from "@/src/lib/http";
import { getNote, upsertNote } from "@/src/lib/services/consultation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const note = await getNote(id, actor);
    return ok({ note });
  } catch (e) {
    return httpError(e);
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const body = await req.json();
    const note = await upsertNote(id, body, actor);
    return ok({ note });
  } catch (e) {
    return httpError(e);
  }
}
