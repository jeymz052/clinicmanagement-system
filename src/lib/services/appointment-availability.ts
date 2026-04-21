import type { ApptType } from "@/src/lib/db/types";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { normalizeClockTime, isPastInClinicTime } from "@/src/lib/timezone";
import {
  getDoctorScheduleForDate,
  getUnavailabilityForDate,
} from "@/src/lib/services/schedule";

export type SharedAvailabilitySlot = {
  start: string;
  end: string;
  mode: "Both";
  bookedCount: number;
  queueNumbers: number[];
  activeType: ApptType | null;
  availableForType: boolean;
  isFull: boolean;
  reason: string;
  nextQueueNumber: number | null;
};

function addDays(date: string, amount: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}

function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function expandSlots(start: string, end: string, minutes: number) {
  const slots: Array<{ start: string; end: string }> = [];
  let cursor = normalizeClockTime(start);
  const stop = normalizeClockTime(end);
  while (cursor < stop) {
    const next = addMinutes(cursor, minutes);
    if (next > stop) break;
    slots.push({ start: cursor, end: next });
    cursor = next;
  }
  return slots;
}

function overlapsSlot(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  return normalizeClockTime(startA) < normalizeClockTime(endB)
    && normalizeClockTime(endA) > normalizeClockTime(startB);
}

function overlapsUnavailable(
  date: string,
  slotStart: string,
  slotEnd: string,
  blocks: { starts_at: string; ends_at: string; reason: string | null }[],
) {
  const slotFrom = new Date(`${date}T${normalizeClockTime(slotStart)}Z`).getTime();
  const slotTo = new Date(`${date}T${normalizeClockTime(slotEnd)}Z`).getTime();
  return (
    blocks.find((block) => {
      const from = new Date(block.starts_at).getTime();
      const to = new Date(block.ends_at).getTime();
      return from < slotTo && to > slotFrom;
    }) ?? null
  );
}

function getNextQueueNumber(queueNumbers: number[]) {
  const used = new Set(queueNumbers.filter((value) => Number.isInteger(value)));
  let candidate = 1;
  while (candidate <= 5 && used.has(candidate)) candidate += 1;
  return candidate <= 5 ? candidate : null;
}

export async function buildSharedDayAvailability(
  doctorId: string,
  date: string,
  type: ApptType,
  options: { ignoreAppointmentId?: string } = {},
): Promise<{
  slots: SharedAvailabilitySlot[];
  blockedReason: string | null;
}> {
  const schedule = await getDoctorScheduleForDate(doctorId, date);
  if (!schedule) {
    return { slots: [], blockedReason: "Doctor is not working on this date." };
  }

  const supabase = getSupabaseAdmin();
  let appointmentsQuery = supabase
    .from("appointments")
    .select("id, start_time, end_time, appointment_type, queue_number, status")
    .eq("doctor_id", doctorId)
    .eq("appointment_date", date);

  if (options.ignoreAppointmentId) {
    appointmentsQuery = appointmentsQuery.neq("id", options.ignoreAppointmentId);
  }

  const [blocks, appointmentsResult] = await Promise.all([
    getUnavailabilityForDate(doctorId, date),
    appointmentsQuery,
  ]);

  if (appointmentsResult.error) throw appointmentsResult.error;

  const appointments = (appointmentsResult.data ?? []).filter(
    (row) => row.status !== "Cancelled" && row.status !== "NoShow",
  );

  const slots = expandSlots(schedule.start_time, schedule.end_time, schedule.slot_minutes).map(
    (slot): SharedAvailabilitySlot => {
      const overlapping = appointments
        .filter((row) => overlapsSlot(slot.start, slot.end, row.start_time, row.end_time))
        .sort((left, right) => left.queue_number - right.queue_number);
      const queueNumbers = overlapping.map((row) => row.queue_number);
      const activeType = overlapping[0]?.appointment_type ?? null;
      const blocked = overlapsUnavailable(date, slot.start, slot.end, blocks);
      const nextQueueNumber = getNextQueueNumber(queueNumbers);
      const isFull = nextQueueNumber === null;
      const typeConflict = activeType !== null && activeType !== type;
      const isPast = isPastInClinicTime(date, slot.start);
      const availableForType = !isPast && !blocked && !typeConflict && !isFull;

      let reason = "Available";
      if (isPast) reason = "Past time";
      else if (blocked) reason = blocked.reason ?? "Doctor unavailable";
      else if (typeConflict) reason = `${activeType} booking already occupies this shared slot`;
      else if (isFull) reason = "Max of 5 patients reached";

      return {
        start: slot.start.slice(0, 5),
        end: slot.end.slice(0, 5),
        mode: "Both",
        bookedCount: overlapping.length,
        queueNumbers,
        activeType,
        availableForType,
        isFull,
        reason,
        nextQueueNumber,
      };
    },
  );

  const blockedReason =
    slots.length === 0
      ? "No schedulable slots on this date."
      : slots.every((slot) => !slot.availableForType)
        ? slots.find((slot) => slot.reason !== "Past time")?.reason ?? "All remaining slots have passed."
        : null;

  return { slots, blockedReason };
}

export async function findNextAvailableSharedSlot(
  doctorId: string,
  date: string,
  type: ApptType,
  scanDays = 14,
  options: { ignoreAppointmentId?: string } = {},
) {
  for (let offset = 0; offset < Math.max(1, scanDays); offset += 1) {
    const nextDate = addDays(date, offset);
    const result = await buildSharedDayAvailability(doctorId, nextDate, type, options);
    const slot = result.slots.find((candidate) => candidate.availableForType);
    if (slot) {
      return { date: nextDate, slot };
    }
  }

  return null;
}
