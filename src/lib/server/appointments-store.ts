import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { Appointment as V2Appointment } from "@/src/lib/db/types";
import type { AuthenticatedUser } from "@/src/lib/auth/server-auth";
import type {
  AppointmentRecord,
  AppointmentType,
} from "@/src/lib/appointments";
import {
  addOneHour,
  findOrCreatePatientByEmail,
  getDoctorSlugById,
  legacyStatusMatchesLiving,
  mapV2RowToLegacy,
  resolveDoctorIdBySlug,
} from "@/src/lib/server/legacy-bridge";
import { getClinicToday, isPastInClinicTime } from "@/src/lib/timezone";
import {
  getSchedulableSlotsForDate,
  getUnavailabilityForDate,
} from "@/src/lib/services/schedule";
import { findNextAvailableSharedSlot } from "@/src/lib/services/appointment-availability";
import { calculateConsultationCharge } from "@/src/lib/consultation-pricing";
import { enqueueNotification } from "@/src/lib/services/notification";

export type AppointmentCreatePayload = {
  patientName: string;
  email: string;
  phone: string;
  doctorId: string;
  date: string;
  start: string;
  type: AppointmentType;
  reason: string;
};

type AppointmentCreateContext = {
  actor?: AuthenticatedUser;
};

export type AppointmentUpdatePayload = AppointmentCreatePayload & { id: string };

const MEETING_BASE = process.env.MEETING_BASE_URL ?? "https://meet.chiara.clinic";

function buildMeetingLink(apptId: string) {
  return `${MEETING_BASE}/${apptId}-${randomUUID().slice(0, 8)}`;
}

function normalizeTime(time: string) {
  return time.length === 5 ? `${time}:00` : time;
}

function overlapsSlot(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  const aStart = normalizeTime(startA);
  const aEnd = normalizeTime(endA);
  const bStart = normalizeTime(startB);
  const bEnd = normalizeTime(endB);
  return aStart < bEnd && aEnd > bStart;
}

function overlapsBlocks(
  date: string,
  start: string,
  end: string,
  blocks: { starts_at: string; ends_at: string }[],
) {
  const from = new Date(`${date}T${normalizeTime(start)}Z`).getTime();
  const to = new Date(`${date}T${normalizeTime(end)}Z`).getTime();
  return blocks.some((block) => {
    const blockFrom = new Date(block.starts_at).getTime();
    const blockTo = new Date(block.ends_at).getTime();
    return blockFrom < to && blockTo > from;
  });
}

async function buildConflictHint(doctorUuid: string, date: string, type: AppointmentType) {
  const next = await findNextAvailableSharedSlot(doctorUuid, date, type, 14);
  if (!next) return "";
  return next.date === date
    ? ` Next available: ${next.slot.start}-${next.slot.end}.`
    : ` Next available: ${next.date} ${next.slot.start}-${next.slot.end}.`;
}

function supportsType(mode: "Clinic" | "Online" | "Both", type: AppointmentType) {
  return mode === "Both" || mode === type;
}

function matchesExactSlot(
  slot: { start: string; end: string },
  start: string,
  end: string,
) {
  return normalizeTime(slot.start) === normalizeTime(start)
    && normalizeTime(slot.end) === normalizeTime(end);
}

export async function validateSharedSlotOrThrow(input: {
  doctorUuid: string;
  date: string;
  start_time: string;
  end_time: string;
  type: AppointmentType;
  ignoreAppointmentId?: string;
  ignoreReservationId?: string;
}) {
  const supabase = getSupabaseAdmin();
  const clinicToday = getClinicToday();
  if (input.date < clinicToday) {
    throw new Error("Past dates cannot be booked.");
  }
  if (isPastInClinicTime(input.date, input.start_time)) {
    throw new Error("Past time slots cannot be booked.");
  }

  const schedulableSlots = await getSchedulableSlotsForDate(input.doctorUuid, input.date);
  if (schedulableSlots.length === 0) {
    throw new Error("Doctor is not working on the selected date.");
  }

  const exactSlot = schedulableSlots.find((slot) =>
    matchesExactSlot(slot, input.start_time, input.end_time),
  );
  if (!exactSlot) {
    throw new Error("Selected time is outside the doctor's working hours.");
  }
  if (!supportsType(exactSlot.mode, input.type)) {
    throw new Error(`${exactSlot.mode} schedule only.`);
  }

  const blocks = await getUnavailabilityForDate(input.doctorUuid, input.date);
  if (overlapsBlocks(input.date, input.start_time, input.end_time, blocks)) {
    const hint = await buildConflictHint(input.doctorUuid, input.date, input.type);
    throw new Error(`Doctor is unavailable during that time.${hint}`);
  }

  let query = supabase
    .from("appointments")
    .select("id, queue_number, status, start_time, end_time, appointment_type")
    .eq("doctor_id", input.doctorUuid)
    .eq("appointment_date", input.date);

  if (input.ignoreAppointmentId) {
    query = query.neq("id", input.ignoreAppointmentId);
  }

  const { data: existing, error } = await query;
  if (error) throw error;

  let reservationQuery = supabase
    .from("online_booking_reservations")
    .select("id, queue_number, status, start_time, end_time")
    .eq("doctor_id", input.doctorUuid)
    .eq("appointment_date", input.date)
    .in("status", ["Pending", "Paid"]);
  if (input.ignoreReservationId) {
    reservationQuery = reservationQuery.neq("id", input.ignoreReservationId);
  }
  const { data: reservations, error: reservationError } = await reservationQuery;
  if (reservationError) throw reservationError;

  const active = (existing ?? []).filter((row) =>
    legacyStatusMatchesLiving(row.status as V2Appointment["status"]),
  );
  const overlapping = active.filter((row) =>
    overlapsSlot(input.start_time, input.end_time, row.start_time, row.end_time),
  );
  const overlappingReservations = (reservations ?? []).filter((row) =>
    overlapsSlot(input.start_time, input.end_time, row.start_time, row.end_time),
  );

  const conflictingType = overlapping.find(
    (row) => row.appointment_type !== input.type,
  );
  const hasReservationConflict =
    input.type === "Clinic" && overlappingReservations.length > 0;
  if (conflictingType || hasReservationConflict) {
    const hint = await buildConflictHint(input.doctorUuid, input.date, input.type);
    throw new Error(
      `${conflictingType?.appointment_type ?? "Online"} booking already occupies this shared slot.${hint}`,
    );
  }

  if (overlapping.length + overlappingReservations.length >= 5) {
    const hint = await buildConflictHint(input.doctorUuid, input.date, input.type);
    throw new Error(`This slot is already full (max 5 patients).${hint}`);
  }

  const used = new Set([
    ...overlapping.map((row) => row.queue_number as number),
    ...overlappingReservations.map((row) => row.queue_number as number),
  ]);
  let queueNumber = 1;
  while (queueNumber <= 5 && used.has(queueNumber)) queueNumber += 1;
  if (queueNumber > 5) {
    throw new Error("This slot is already full (max 5 patients).");
  }

  return { queueNumber };
}

export async function resolveBookingPatientId(
  payload: Pick<AppointmentCreatePayload, "email" | "patientName" | "phone">,
  options: { actorRole?: AuthenticatedUser["role"]; actorUserId?: string } = {},
) {
  const supabase = getSupabaseAdmin();
  if (options.actorRole === "PATIENT" && options.actorUserId) {
    const patientUuid = options.actorUserId;
    await supabase
      .from("profiles")
      .update({
        full_name: payload.patientName,
        phone: payload.phone,
        role: "patient",
        is_active: true,
      })
      .eq("id", patientUuid);

    await supabase
      .from("patients")
      .upsert({
        id: patientUuid,
      });

    return patientUuid;
  }

  return findOrCreatePatientByEmail(
    payload.email,
    payload.patientName,
    payload.phone,
  );
}

async function hydrateRows(rows: V2Appointment[]): Promise<AppointmentRecord[]> {
  if (rows.length === 0) return [];
  const supabase = getSupabaseAdmin();

  const patientIds = [...new Set(rows.map((r) => r.patient_id))];
  const doctorIds = [...new Set(rows.map((r) => r.doctor_id))];

  const [{ data: profiles }, { data: doctors }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, phone, full_name")
      .in("id", patientIds),
    supabase.from("doctors").select("id, slug").in("id", doctorIds),
  ]);

  const profilesById = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      p as { id: string; email: string; phone: string | null; full_name: string },
    ]),
  );
  const slugsById = new Map((doctors ?? []).map((d) => [d.id as string, (d.slug as string) ?? d.id]));

  return Promise.all(
    rows.map((row) => {
      const profile = profilesById.get(row.patient_id);
      return mapV2RowToLegacy(
        row,
        {
          full_name: profile?.full_name ?? "Unknown",
          email: profile?.email ?? "",
          phone: profile?.phone ?? null,
        },
        slugsById.get(row.doctor_id) ?? row.doctor_id,
      );
    }),
  );
}

export type AppointmentFilter = {
  patientId?: string;
  patientEmail?: string;
  doctorId?: string;
};

export async function readAppointments(
  filter: AppointmentFilter = {},
): Promise<AppointmentRecord[]> {
  const supabase = getSupabaseAdmin();

  let patientId = filter.patientId;
  if (!patientId && filter.patientEmail) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", filter.patientEmail.toLowerCase())
      .maybeSingle<{ id: string }>();
    if (!data) return [];
    patientId = data.id;
  }

  let q = supabase
    .from("appointments")
    .select("*")
    .neq("status", "Cancelled")
    .neq("status", "NoShow");
  if (patientId) q = q.eq("patient_id", patientId);
  if (filter.doctorId) q = q.eq("doctor_id", filter.doctorId);

  const { data, error } = await q
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("queue_number", { ascending: true });
  if (error) throw error;
  return hydrateRows((data ?? []) as V2Appointment[]);
}

export async function writeAppointments() {
  throw new Error("writeAppointments() is deprecated â€” use v2 booking service");
}

export async function createPersistedAppointment(payload: AppointmentCreatePayload) {
  return createPersistedAppointmentWithContext(payload);
}

export async function createPersistedAppointmentWithContext(
  payload: AppointmentCreatePayload,
  context: AppointmentCreateContext = {},
) {
  const supabase = getSupabaseAdmin();
  try {
    const doctorUuid = await resolveDoctorIdBySlug(payload.doctorId);
    if (payload.type === "Online") {
      throw new Error("Online consultations require payment first. Start checkout to confirm the slot.");
    }

    const patientUuid = await resolveBookingPatientId(payload, {
      actorRole: context.actor?.role,
      actorUserId: context.actor?.user.id,
    });

    const start_time = `${payload.start}:00`;
    const end_time = `${addOneHour(payload.start)}:00`;
    const { queueNumber } = await validateSharedSlotOrThrow({
      doctorUuid,
      date: payload.date,
      start_time,
      end_time,
      type: payload.type,
    });

    const { data: inserted, error: insertErr } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientUuid,
        doctor_id: doctorUuid,
        appointment_date: payload.date,
        start_time,
        end_time,
        appointment_type: payload.type,
        reason: payload.reason,
        status: "PendingApproval",
        queue_number: queueNumber,
      })
      .select()
      .single<V2Appointment>();
    if (insertErr) throw insertErr;

    await enqueueNotification({
      user_id: patientUuid,
      template: "appointment_booked",
      channels: ["email", "sms"],
      payload: { appointment_id: inserted.id, appointment_type: payload.type },
    });

    const appointment = (await hydrateRows([inserted]))[0];
    return {
      ok: true as const,
      message: payload.type === "Clinic" ? "Appointment booked and awaiting approval." : "Appointment booked successfully.",
      appointment,
      appointments: context.actor?.role === "PATIENT"
        ? await readAppointments({ patientId: patientUuid })
        : await readAppointments(),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Booking failed";
    return {
      ok: false as const,
      message,
      appointments:
        context.actor?.role === "PATIENT"
          ? await readAppointments({ patientId: context.actor.user.id })
          : await readAppointments(),
    };
  }
}

export async function updatePersistedAppointment(payload: AppointmentUpdatePayload) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", payload.id)
      .single<V2Appointment>();
    if (fetchErr || !existing) {
      return {
        ok: false as const,
        message: "Appointment not found.",
        appointments: await readAppointments(),
      };
    }

    const doctorUuid = await resolveDoctorIdBySlug(payload.doctorId);
    const start_time = `${payload.start}:00`;
    const end_time = `${addOneHour(payload.start)}:00`;
    if (payload.type === "Online" && existing.appointment_type !== "Online") {
      return {
        ok: false as const,
        message: "Converting a clinic booking to online requires a new pay-first online booking.",
        appointments: await readAppointments(),
      };
    }
    const { queueNumber } = await validateSharedSlotOrThrow({
      doctorUuid,
      date: payload.date,
      start_time,
      end_time,
      type: payload.type,
      ignoreAppointmentId: payload.id,
    });

    const status =
      payload.type === "Online"
        ? existing.status === "Confirmed" && existing.meeting_link
          ? "Confirmed"
          : "PendingPayment"
        : existing.status === "Completed"
          ? "Completed"
          : existing.status === "Confirmed"
            ? "Confirmed"
            : "PendingApproval";

    const meeting_link = payload.type === "Online" ? existing.meeting_link : null;

    const { error: updateErr } = await supabase
      .from("appointments")
      .update({
        doctor_id: doctorUuid,
        appointment_date: payload.date,
        start_time,
        end_time,
        appointment_type: payload.type,
        reason: payload.reason,
        status,
        meeting_link,
        queue_number: queueNumber,
      })
      .eq("id", payload.id);
    if (updateErr) {
      return {
        ok: false as const,
        message: "The updated slot is unavailable.",
        appointments: await readAppointments(),
      };
    }

    const appointments = await readAppointments();
    const appointment = appointments.find((a) => a.id === payload.id);
    return {
      ok: true as const,
      message: "Appointment updated successfully.",
      appointment: appointment ?? null,
      appointments,
    };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Update failed",
      appointments: await readAppointments(),
    };
  }
}

export async function deletePersistedAppointment(appointmentId: string) {
  const supabase = getSupabaseAdmin();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id")
    .eq("id", appointmentId)
    .maybeSingle<{ id: string; patient_id: string }>();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "Cancelled" })
    .eq("id", appointmentId);
  if (error) {
    return {
      ok: false as const,
      message: "Failed to cancel appointment.",
      appointments: await readAppointments(),
    };
  }

  if (appt) {
    await enqueueNotification({
      user_id: appt.patient_id,
      template: "appointment_cancelled",
      channels: ["email", "sms"],
      payload: { appointment_id: appointmentId },
    });
  }

  return {
    ok: true as const,
    message: "Appointment cancelled.",
    appointments: await readAppointments(),
  };
}

export async function markAppointmentPaid(appointmentId: string) {
  const supabase = getSupabaseAdmin();
  const { data: appt, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single<V2Appointment>();
  if (error || !appt) {
    return {
      ok: false as const,
      message: "Appointment not found.",
      appointments: await readAppointments(),
    };
  }
  if (appt.appointment_type !== "Online") {
    return {
      ok: false as const,
      message: "Only online consultations require advance payment.",
      appointments: await readAppointments(),
    };
  }
  if (appt.status === "Confirmed" && appt.meeting_link) {
    const appointments = await readAppointments();
    return {
      ok: true as const,
      message: "Payment is already confirmed and the meeting link is available.",
      appointment: appointments.find((a) => a.id === appointmentId) ?? null,
      appointments,
    };
  }

  const { data: doctor } = await supabase
    .from("doctors")
    .select("consultation_fee_online")
    .eq("id", appt.doctor_id)
    .maybeSingle<{ consultation_fee_online: number }>();
  const amount = calculateConsultationCharge(
    Number(doctor?.consultation_fee_online ?? 0),
    appt.start_time,
    appt.end_time,
  );

  const { error: payErr } = await supabase.from("payments").insert({
    appointment_id: appt.id,
    amount,
    method: "Cash",
    status: "Paid",
    paid_at: new Date().toISOString(),
    provider: "manual",
    provider_ref: `manual_${randomUUID()}`,
  });
  if (payErr) throw payErr;

  const meeting_link = buildMeetingLink(appt.id);
  const { error: apptErr } = await supabase
    .from("appointments")
    .update({ status: "Confirmed", meeting_link })
    .eq("id", appt.id);
  if (apptErr) throw apptErr;

  await enqueueNotification({
    user_id: appt.patient_id,
    template: "appointment_confirmed",
    channels: ["email", "sms"],
    payload: { appointment_id: appt.id, meeting_link },
  });
  await enqueueNotification({
    user_id: appt.patient_id,
    template: "appointment_payment_success",
    channels: ["email", "sms"],
    payload: { appointment_id: appt.id, meeting_link },
  });
  await enqueueNotification({
    user_id: appt.patient_id,
    template: "online_meeting_link",
    channels: ["email", "sms"],
    payload: { appointment_id: appt.id, meeting_link },
  });

  const appointments = await readAppointments();
  return {
    ok: true as const,
    message: "Payment confirmed and meeting link generated.",
    appointment: appointments.find((a) => a.id === appointmentId) ?? null,
    appointments,
  };
}

export async function approveClinicAppointment(appointmentId: string) {
  const supabase = getSupabaseAdmin();
  const { data: appt, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single<V2Appointment>();
  if (error || !appt) {
    return {
      ok: false as const,
      message: "Appointment not found.",
      appointments: await readAppointments(),
    };
  }
  if (appt.appointment_type !== "Clinic") {
    return {
      ok: false as const,
      message: "Only clinic appointments use manual approval.",
      appointments: await readAppointments(),
    };
  }
  if (appt.status === "Confirmed") {
    const appointments = await readAppointments();
    return {
      ok: true as const,
      message: "Appointment is already approved.",
      appointment: appointments.find((item) => item.id === appointmentId) ?? null,
      appointments,
    };
  }
  if (appt.status !== "PendingApproval") {
    return {
      ok: false as const,
      message: `Cannot approve appointment from status ${appt.status}.`,
      appointments: await readAppointments(),
    };
  }

  const { error: updateErr } = await supabase
    .from("appointments")
    .update({ status: "Confirmed" })
    .eq("id", appt.id);
  if (updateErr) throw updateErr;

  await enqueueNotification({
    user_id: appt.patient_id,
    template: "appointment_confirmed",
    channels: ["email", "sms"],
    payload: { appointment_id: appt.id },
  });

  const appointments = await readAppointments();
  return {
    ok: true as const,
    message: "Clinic appointment approved.",
    appointment: appointments.find((item) => item.id === appointmentId) ?? null,
    appointments,
  };
}

export async function markClinicAppointmentComplete(appointmentId: string) {
  const supabase = getSupabaseAdmin();
  const { data: appt, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single<V2Appointment>();
  if (error || !appt) {
    return {
      ok: false as const,
      message: "Appointment not found.",
      appointments: await readAppointments(),
    };
  }

  const { error: updateErr } = await supabase
    .from("appointments")
    .update({ status: "Completed" })
    .eq("id", appt.id);
  if (updateErr) throw updateErr;

  const appointments = await readAppointments();
  return {
    ok: true as const,
    message: "Clinic appointment settled through POS.",
    appointment: appointments.find((a) => a.id === appointmentId) ?? null,
    appointments,
  };
}

export async function syncAppointmentsToSupabase() {
  return {
    ok: false as const,
    message: "Sync is no longer required â€” appointments live in Supabase.",
  };
}

export { getDoctorSlugById };
