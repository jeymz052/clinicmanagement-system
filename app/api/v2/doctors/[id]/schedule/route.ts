import { HttpError, httpError, ok, requireActor, isStaff } from "@/src/lib/http";
import {
  deleteSchedule,
  updateSchedule,
  upsertSchedule,
} from "@/src/lib/services/schedule";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("doctor_schedules")
      .select("*")
      .eq("doctor_id", id)
      .order("day_of_week");
    if (error) throw error;
    return ok({ schedules: data ?? [] });
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
    const schedule = await upsertSchedule({ ...body, doctor_id: id });
    return ok({ schedule }, 201);
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
    const scheduleId = url.searchParams.get("schedule_id");
    if (!scheduleId) throw new HttpError(400, "schedule_id required");
    await deleteSchedule(scheduleId);
    return ok({ ok: true });
  } catch (e) {
    return httpError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const allowed =
      isStaff(actor.profile.role) ||
      (actor.profile.role === "doctor" && actor.id === id);
    if (!allowed) throw new HttpError(403, "Forbidden");

    const body = await req.json();
    if (!body.schedule_id) throw new HttpError(400, "schedule_id required");
    const schedule = await updateSchedule(body.schedule_id, {
      start_time: body.start_time,
      end_time: body.end_time,
      slot_minutes: body.slot_minutes,
      is_active: body.is_active,
    });
    return ok({ schedule });
  } catch (e) {
    return httpError(e);
  }
}
