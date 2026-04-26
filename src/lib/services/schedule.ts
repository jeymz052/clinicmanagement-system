import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { SLOT_TEMPLATES_BY_DOCTOR } from "@/src/lib/appointments";
import { isPastInClinicTime } from "@/src/lib/timezone";
import type {
  DoctorSchedule,
  DoctorUnavailability,
  ScheduleMode,
} from "@/src/lib/db/types";
import { HttpError } from "@/src/lib/http";

export type Slot = {
  start: string;
  end: string;
  remaining: number;
  disabled: boolean;
  reason?: "full" | "blocked" | "past";
};

export type SchedulableSlot = {
  start: string;
  end: string;
  mode: ScheduleMode;
};

function dayOfWeek(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function expandSlots(start: string, end: string, minutes: number, mode: ScheduleMode) {
  const slots: { start: string; end: string; mode: ScheduleMode }[] = [];
  let cursor = start.length === 5 ? `${start}:00` : start;
  const stop = end.length === 5 ? `${end}:00` : end;
  while (cursor < stop) {
    const next = addMinutes(cursor, minutes);
    if (next > stop) break;
    slots.push({ start: cursor, end: next, mode });
    cursor = next;
  }
  return slots;
}

async function getClinicHours() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("system_settings")
    .select("clinic_open_time, clinic_close_time")
    .eq("id", true)
    .maybeSingle<{ clinic_open_time: string | null; clinic_close_time: string | null }>();
  if (error) throw error;
  return {
    open: data?.clinic_open_time?.slice(0, 5) ?? "08:00",
    close: data?.clinic_close_time?.slice(0, 5) ?? "17:00",
  };
}

function normalizeClock(value: string) {
  return value.slice(0, 5);
}

async function assertWithinClinicHours(start: string, end: string) {
  const hours = await getClinicHours();
  const normalizedStart = normalizeClock(start);
  const normalizedEnd = normalizeClock(end);
  if (normalizedStart < hours.open || normalizedEnd > hours.close) {
    throw new HttpError(400, `Schedule must stay within clinic hours (${hours.open}-${hours.close}).`);
  }
}

async function getDoctorTemplateKey(doctorId: string) {
  if (SLOT_TEMPLATES_BY_DOCTOR[doctorId]) {
    return doctorId;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctors")
    .select("slug")
    .eq("id", doctorId)
    .maybeSingle<{ slug: string | null }>();
  if (error) throw error;

  const slug = data?.slug ?? null;
  if (slug && SLOT_TEMPLATES_BY_DOCTOR[slug]) {
    return slug;
  }

  return null;
}

export async function getSchedulableSlotsForDate(
  doctorId: string,
  date: string,
): Promise<SchedulableSlot[]> {
  const clinicHours = await getClinicHours();
  const schedule = await getDoctorScheduleForDate(doctorId, date);
  if (schedule) {
    return expandSlots(
      schedule.start_time,
      schedule.end_time,
      schedule.slot_minutes,
      schedule.schedule_mode ?? "Both",
    ).filter((slot) => normalizeClock(slot.start) >= clinicHours.open && normalizeClock(slot.end) <= clinicHours.close);
  }

  const templateKey = await getDoctorTemplateKey(doctorId);
  if (!templateKey) return [];

  return (SLOT_TEMPLATES_BY_DOCTOR[templateKey] ?? [])
    .map((slot) => ({
      start: slot.start.length === 5 ? `${slot.start}:00` : slot.start,
      end: slot.end.length === 5 ? `${slot.end}:00` : slot.end,
      mode: slot.mode,
    }))
    .filter((slot) => normalizeClock(slot.start) >= clinicHours.open && normalizeClock(slot.end) <= clinicHours.close);
}

export async function getDoctorScheduleForDate(
  doctorId: string,
  date: string,
): Promise<DoctorSchedule | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_schedules")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("day_of_week", dayOfWeek(date))
    .eq("is_active", true)
    .maybeSingle<DoctorSchedule>();
  if (error) throw error;
  return data;
}

export async function getUnavailabilityForDate(
  doctorId: string,
  date: string,
): Promise<DoctorUnavailability[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_unavailability")
    .select("*")
    .eq("doctor_id", doctorId)
    .lt("starts_at", `${date}T23:59:59Z`)
    .gt("ends_at", `${date}T00:00:00Z`);
  if (error) throw error;
  return data ?? [];
}

function overlapsUnavailable(
  date: string,
  slotStart: string,
  slotEnd: string,
  blocks: DoctorUnavailability[],
) {
  const slotFrom = new Date(`${date}T${slotStart}Z`).getTime();
  const slotTo = new Date(`${date}T${slotEnd}Z`).getTime();
  return blocks.some((b) => {
    const from = new Date(b.starts_at).getTime();
    const to = new Date(b.ends_at).getTime();
    return from < slotTo && to > slotFrom;
  });
}

export async function getAvailability(doctorId: string, date: string): Promise<Slot[]> {
  const supabase = getSupabaseAdmin();
  const slots = await getSchedulableSlotsForDate(doctorId, date);
  if (slots.length === 0) return [];
  const blocks = await getUnavailabilityForDate(doctorId, date);

  const { data: counts, error } = await supabase
    .from("appointments")
    .select("start_time, status")
    .eq("doctor_id", doctorId)
    .eq("appointment_date", date);
  if (error) throw error;

  const byStart = new Map<string, number>();
  for (const row of counts ?? []) {
    const r = row as { start_time: string; status: string };
    if (r.status === "Cancelled" || r.status === "NoShow") continue;
    const key = r.start_time.slice(0, 8);
    byStart.set(key, (byStart.get(key) ?? 0) + 1);
  }

  return slots.map((s) => {
    const past = isPastInClinicTime(date, s.start);
    const blocked = overlapsUnavailable(date, s.start, s.end, blocks);
    const taken = byStart.get(s.start) ?? 0;
    const full = taken >= 5;
    return {
      start: s.start,
      end: s.end,
      remaining: blocked || past ? 0 : Math.max(0, 5 - taken),
      disabled: past || blocked || full,
      reason: past ? "past" : blocked ? "blocked" : full ? "full" : undefined,
    };
  });
}

export function suggestNextSlot(slots: Slot[]): Slot | null {
  return slots.find((s) => !s.disabled) ?? null;
}

export async function upsertSchedule(input: {
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes?: number;
  schedule_mode?: ScheduleMode;
  is_active?: boolean;
}) {
  if (input.day_of_week < 0 || input.day_of_week > 6)
    throw new HttpError(400, "day_of_week must be 0..6");
  if (input.start_time >= input.end_time)
    throw new HttpError(400, "start_time must be before end_time");
  await assertWithinClinicHours(input.start_time, input.end_time);

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from("doctor_schedules")
    .select("id")
    .eq("doctor_id", input.doctor_id)
    .eq("day_of_week", input.day_of_week)
    .maybeSingle<{ id: string }>();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("doctor_schedules")
      .update({
        start_time: input.start_time,
        end_time: input.end_time,
        slot_minutes: input.slot_minutes ?? 60,
        schedule_mode: input.schedule_mode ?? "Both",
        is_active: input.is_active ?? true,
      })
      .eq("id", existing.id)
      .select()
      .single<DoctorSchedule>();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("doctor_schedules")
    .insert({
      doctor_id: input.doctor_id,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      slot_minutes: input.slot_minutes ?? 60,
      schedule_mode: input.schedule_mode ?? "Both",
      is_active: input.is_active ?? true,
    })
    .select()
    .single<DoctorSchedule>();
  if (error) throw error;
  return data;
}

export async function deleteSchedule(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("doctor_schedules").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSchedule(
  id: string,
  input: {
    start_time?: string;
    end_time?: string;
    slot_minutes?: number;
    schedule_mode?: ScheduleMode;
    is_active?: boolean;
  },
) {
  if (
    input.start_time &&
    input.end_time &&
    input.start_time >= input.end_time
  ) {
    throw new HttpError(400, "start_time must be before end_time");
  }
  if (input.start_time && input.end_time) {
    await assertWithinClinicHours(input.start_time, input.end_time);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_schedules")
    .update(input)
    .eq("id", id)
    .select()
    .single<DoctorSchedule>();
  if (error) throw error;
  return data;
}

export async function addUnavailability(input: {
  doctor_id: string;
  starts_at: string;
  ends_at: string;
  reason?: string;
}) {
  if (input.starts_at >= input.ends_at)
    throw new HttpError(400, "starts_at must be before ends_at");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_unavailability")
    .insert({
      doctor_id: input.doctor_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      reason: input.reason ?? null,
    })
    .select()
    .single<DoctorUnavailability>();
  if (error) throw error;
  return data;
}

export async function deleteUnavailability(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("doctor_unavailability").delete().eq("id", id);
  if (error) throw error;
}
