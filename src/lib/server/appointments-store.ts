import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { Appointment as V2Appointment } from "@/src/lib/db/types";
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

export type AppointmentUpdatePayload = AppointmentCreatePayload & { id: string };

const MEETING_BASE = process.env.MEETING_BASE_URL ?? "https://meet.chiara.clinic";

function buildMeetingLink(apptId: string) {
  return `${MEETING_BASE}/${apptId}-${randomUUID().slice(0, 8)}`;
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

  // Resolve patientId from email if provided
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
    .not("status", "in", "(Cancelled,NoShow)");
  if (patientId) q = q.eq("patient_id", patientId);
  if (filter.doctorId) q = q.eq("doctor_id", filter.doctorId);

  const { data, error } = await q
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("queue_number", { ascending: true });
  if (error) throw error;
  return hydrateRows((data ?? []) as V2Appointment[]);
}

export async function writeAppointments(_appointments: AppointmentRecord[]) {
  throw new Error("writeAppointments() is deprecated — use v2 booking service");
}

export async function createPersistedAppointment(payload: AppointmentCreatePayload) {
  const supabase = getSupabaseAdmin();
  try {
    const doctorUuid = await resolveDoctorIdBySlug(payload.doctorId);
    const patientUuid = await findOrCreatePatientByEmail(
      payload.email,
      payload.patientName,
      payload.phone,
    );

    const start_time = `${payload.start}:00`;
    const end_time = `${addOneHour(payload.start)}:00`;

    const { data: existing, error: existingErr } = await supabase
      .from("appointments")
      .select("queue_number, status")
      .eq("doctor_id", doctorUuid)
      .eq("appointment_date", payload.date)
      .eq("start_time", start_time);
    if (existingErr) throw existingErr;

    const active = (existing ?? []).filter((r) =>
      legacyStatusMatchesLiving(r.status as V2Appointment["status"]),
    );
    if (active.length >= 5) {
      return {
        ok: false as const,
        message: "That slot is no longer available. Please choose another time.",
        appointments: await readAppointments(),
      };
    }
    const used = new Set(active.map((r) => r.queue_number as number));
    let queue_number = 1;
    while (queue_number <= 5 && used.has(queue_number)) queue_number++;

    const { data: leave, error: leaveErr } = await supabase
      .from("doctor_unavailability")
      .select("starts_at, ends_at")
      .eq("doctor_id", doctorUuid)
      .lt("starts_at", `${payload.date}T23:59:59Z`)
      .gt("ends_at", `${payload.date}T00:00:00Z`);
    if (leaveErr) throw leaveErr;

    const slotFrom = new Date(`${payload.date}T${start_time}Z`).getTime();
    const slotTo = new Date(`${payload.date}T${end_time}Z`).getTime();
    const overlaps = (leave ?? []).some((b) => {
      const from = new Date(b.starts_at as string).getTime();
      const to = new Date(b.ends_at as string).getTime();
      return from < slotTo && to > slotFrom;
    });
    if (overlaps) {
      return {
        ok: false as const,
        message: "The doctor is unavailable at that time.",
        appointments: await readAppointments(),
      };
    }

    const status = payload.type === "Online" ? "PendingPayment" : "Confirmed";

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
        status,
        queue_number,
      })
      .select()
      .single<V2Appointment>();
    if (insertErr) throw insertErr;

    const appointment = (await hydrateRows([inserted]))[0];
    return {
      ok: true as const,
      message: "Appointment booked successfully.",
      appointment,
      appointments: await readAppointments(),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Booking failed";
    return {
      ok: false as const,
      message,
      appointments: await readAppointments(),
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

    const { error: updateErr } = await supabase
      .from("appointments")
      .update({
        doctor_id: doctorUuid,
        appointment_date: payload.date,
        start_time,
        end_time,
        appointment_type: payload.type,
        reason: payload.reason,
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

  const { error: payErr } = await supabase.from("payments").insert({
    appointment_id: appt.id,
    amount: doctor?.consultation_fee_online ?? 0,
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

  const appointments = await readAppointments();
  return {
    ok: true as const,
    message: "Payment confirmed and meeting link generated.",
    appointment: appointments.find((a) => a.id === appointmentId) ?? null,
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
    message: "Sync is no longer required — appointments live in Supabase.",
  };
}

// Re-export for callers that imported the slug resolver via this module.
export { getDoctorSlugById };
