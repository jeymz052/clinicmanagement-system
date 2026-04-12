import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildBlockedDayLookup,
  buildMeetingLink,
  createAppointmentRecord,
  INITIAL_APPOINTMENTS,
  type AppointmentRecord,
  type AppointmentType,
} from "@/src/lib/appointments";
import { readDoctorUnavailability } from "@/src/lib/server/clinic-store";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

const APPOINTMENTS_FILE = path.join(process.cwd(), "data", "appointments.json");

type AppointmentRow = {
  id: string;
  patient_name: string;
  email: string;
  phone: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: AppointmentType;
  reason: string;
  status: AppointmentRecord["status"];
  queue_number: number;
  meeting_link: string | null;
};

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

export type AppointmentUpdatePayload = {
  id: string;
  patientName: string;
  email: string;
  phone: string;
  doctorId: string;
  date: string;
  start: string;
  type: AppointmentType;
  reason: string;
};

async function ensureAppointmentsFile() {
  try {
    await fs.access(APPOINTMENTS_FILE);
  } catch {
    await fs.mkdir(path.dirname(APPOINTMENTS_FILE), { recursive: true });
    await fs.writeFile(
      APPOINTMENTS_FILE,
      JSON.stringify(INITIAL_APPOINTMENTS, null, 2),
      "utf8",
    );
  }
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function mapRowToAppointment(row: AppointmentRow): AppointmentRecord {
  return {
    id: row.id,
    patientName: row.patient_name,
    email: row.email,
    phone: row.phone,
    doctorId: row.doctor_id,
    date: row.appointment_date,
    start: normalizeTime(row.start_time),
    end: normalizeTime(row.end_time),
    type: row.appointment_type,
    reason: row.reason,
    status: row.status,
    queueNumber: row.queue_number,
    meetingLink: row.meeting_link,
  };
}

function mapAppointmentToRow(appointment: AppointmentRecord): AppointmentRow {
  return {
    id: appointment.id,
    patient_name: appointment.patientName,
    email: appointment.email,
    phone: appointment.phone,
    doctor_id: appointment.doctorId,
    appointment_date: appointment.date,
    start_time: appointment.start,
    end_time: appointment.end,
    appointment_type: appointment.type,
    reason: appointment.reason,
    status: appointment.status,
    queue_number: appointment.queueNumber,
    meeting_link: appointment.meetingLink,
  };
}

async function readAppointmentsFromFile() {
  await ensureAppointmentsFile();
  const raw = await fs.readFile(APPOINTMENTS_FILE, "utf8");
  const appointments = JSON.parse(raw) as Partial<AppointmentRecord>[];

  return appointments.map((appointment) => ({
    ...appointment,
    meetingLink: appointment.meetingLink ?? null,
  })) as AppointmentRecord[];
}

async function writeAppointmentsToFile(appointments: AppointmentRecord[]) {
  await ensureAppointmentsFile();
  await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2), "utf8");
}

async function readAppointmentsFromSupabase() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("queue_number", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapRowToAppointment(row as AppointmentRow));
}

async function insertAppointmentToSupabase(appointment: AppointmentRecord) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("appointments").insert(mapAppointmentToRow(appointment));

  if (error) {
    throw error;
  }
}

async function updateAppointmentInSupabase(appointment: AppointmentRecord) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("appointments")
    .update(mapAppointmentToRow(appointment))
    .eq("id", appointment.id);

  if (error) {
    throw error;
  }
}

export async function readAppointments() {
  if (isSupabaseConfigured()) {
    return readAppointmentsFromSupabase();
  }

  return readAppointmentsFromFile();
}

export async function writeAppointments(appointments: AppointmentRecord[]) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error: deleteError } = await supabase.from("appointments").delete().neq("id", "");

    if (deleteError) {
      throw deleteError;
    }

    if (appointments.length === 0) {
      return;
    }

    const { error: insertError } = await supabase
      .from("appointments")
      .insert(appointments.map(mapAppointmentToRow));

    if (insertError) {
      throw insertError;
    }

    return;
  }

  await writeAppointmentsToFile(appointments);
}

export async function createPersistedAppointment(payload: AppointmentCreatePayload) {
  const appointments = await readAppointments();
  const blockedDays = buildBlockedDayLookup(
    await readDoctorUnavailability(),
    payload.doctorId,
  );
  const appointment = createAppointmentRecord(payload, appointments, blockedDays);

  if (!appointment) {
    return {
      ok: false as const,
      message:
        "That slot is no longer available. Please choose another time or use the next available suggestion.",
      appointments,
    };
  }

  if (isSupabaseConfigured()) {
    await insertAppointmentToSupabase(appointment);
  } else {
    await writeAppointmentsToFile([...appointments, appointment]);
  }

  const nextAppointments = [...appointments, appointment];

  return {
    ok: true as const,
    message: "Appointment booked successfully.",
    appointment,
    appointments: nextAppointments,
  };
}

function resequenceAppointments(appointments: AppointmentRecord[]) {
  const grouped = new Map<string, AppointmentRecord[]>();

  for (const appointment of appointments) {
    const key = `${appointment.doctorId}:${appointment.date}:${appointment.start}`;
    const existing = grouped.get(key) ?? [];
    existing.push(appointment);
    grouped.set(key, existing);
  }

  return appointments.map((appointment) => {
    const key = `${appointment.doctorId}:${appointment.date}:${appointment.start}`;
    const sorted = (grouped.get(key) ?? []).sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const nextQueueNumber = sorted.findIndex((item) => item.id === appointment.id) + 1;
    const nextMeetingLink =
      appointment.type === "Online" && appointment.status === "Paid"
        ? buildMeetingLink({ ...appointment, queueNumber: nextQueueNumber })
        : appointment.meetingLink;

    return {
      ...appointment,
      queueNumber: nextQueueNumber,
      meetingLink: nextMeetingLink,
    };
  });
}

export async function updatePersistedAppointment(payload: AppointmentUpdatePayload) {
  const appointments = await readAppointments();
  const existing = appointments.find((appointment) => appointment.id === payload.id);

  if (!existing) {
    return {
      ok: false as const,
      message: "Appointment not found.",
      appointments,
    };
  }

  const withoutCurrent = appointments.filter((appointment) => appointment.id !== payload.id);
  const blockedDays = buildBlockedDayLookup(
    await readDoctorUnavailability(),
    payload.doctorId,
  );
  const draft = createAppointmentRecord(payload, withoutCurrent, blockedDays);

  if (!draft) {
    return {
      ok: false as const,
      message: "The updated slot is unavailable. Choose another date or time.",
      appointments,
    };
  }

  const updatedAppointment: AppointmentRecord = {
    ...existing,
    ...draft,
    id: existing.id,
    status:
      draft.type === "Clinic"
        ? "Confirmed"
        : existing.type === "Online" && existing.status === "Paid"
          ? "Paid"
          : "Pending Payment",
    meetingLink:
      draft.type === "Online" && existing.status === "Paid"
        ? buildMeetingLink({ ...draft, queueNumber: draft.queueNumber })
        : null,
  };

  const resequenced = resequenceAppointments([...withoutCurrent, updatedAppointment]);
  await writeAppointments(resequenced);

  return {
    ok: true as const,
    message: "Appointment updated successfully.",
    appointment: resequenced.find((appointment) => appointment.id === payload.id) ?? updatedAppointment,
    appointments: resequenced,
  };
}

export async function deletePersistedAppointment(appointmentId: string) {
  const appointments = await readAppointments();
  const existing = appointments.find((appointment) => appointment.id === appointmentId);

  if (!existing) {
    return {
      ok: false as const,
      message: "Appointment not found.",
      appointments,
    };
  }

  const resequenced = resequenceAppointments(
    appointments.filter((appointment) => appointment.id !== appointmentId),
  );
  await writeAppointments(resequenced);

  return {
    ok: true as const,
    message: "Appointment deleted successfully.",
    appointments: resequenced,
  };
}

export async function markClinicAppointmentComplete(appointmentId: string) {
  const appointments = await readAppointments();
  const existing = appointments.find((appointment) => appointment.id === appointmentId);

  if (!existing) {
    return { ok: false as const, message: "Appointment not found.", appointments };
  }

  const updated: AppointmentRecord = {
    ...existing,
    status: "Completed",
  };
  const nextAppointments = appointments.map((appointment) =>
    appointment.id === appointmentId ? updated : appointment,
  );
  await writeAppointments(nextAppointments);

  return {
    ok: true as const,
    message: "Clinic appointment settled through POS.",
    appointment: updated,
    appointments: nextAppointments,
  };
}

export async function markAppointmentPaid(appointmentId: string) {
  const appointments = await readAppointments();
  const appointmentIndex = appointments.findIndex((appointment) => appointment.id === appointmentId);

  if (appointmentIndex === -1) {
    return {
      ok: false as const,
      message: "Appointment not found.",
      appointments,
    };
  }

  const appointment = appointments[appointmentIndex];

  if (appointment.type !== "Online") {
    return {
      ok: false as const,
      message: "Only online consultations require advance payment.",
      appointments,
    };
  }

  if (appointment.status === "Paid" && appointment.meetingLink) {
    return {
      ok: true as const,
      message: "Payment is already confirmed and the meeting link is available.",
      appointment,
      appointments,
    };
  }

  const updatedAppointment: AppointmentRecord = {
    ...appointment,
    status: "Paid",
    meetingLink: appointment.meetingLink ?? buildMeetingLink(appointment),
  };

  if (isSupabaseConfigured()) {
    await updateAppointmentInSupabase(updatedAppointment);
  } else {
    const nextAppointments = appointments.map((currentAppointment, index) =>
      index === appointmentIndex ? updatedAppointment : currentAppointment,
    );
    await writeAppointmentsToFile(nextAppointments);
  }

  const nextAppointments = appointments.map((currentAppointment, index) =>
    index === appointmentIndex ? updatedAppointment : currentAppointment,
  );

  return {
    ok: true as const,
    message: "Payment confirmed and meeting link generated.",
    appointment: updatedAppointment,
    appointments: nextAppointments,
  };
}

export async function syncAppointmentsToSupabase() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      message: "Supabase is not configured yet.",
    };
  }

  const appointments = await readAppointmentsFromFile();
  await writeAppointments(appointments);

  return {
    ok: true as const,
    message: `Synced ${appointments.length} appointments to Supabase.`,
  };
}
