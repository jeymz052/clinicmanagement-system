import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor, isStaff } from "@/src/lib/http";
import type { ConsultationNote } from "@/src/lib/db/types";
import { getAppointment } from "@/src/lib/services/booking";

export type NoteInput = {
  chief_complaint?: string | null;
  diagnosis?: string | null;
  prescription?: string | null;
  notes?: string | null;
};

export async function upsertNote(
  appointmentId: string,
  input: NoteInput,
  actor: Actor,
): Promise<ConsultationNote> {
  const appt = await getAppointment(appointmentId);
  if (actor.profile.role !== "doctor" || actor.id !== appt.doctor_id)
    throw new HttpError(403, "Only the assigned doctor can write notes");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("consultation_notes")
    .upsert(
      {
        appointment_id: appt.id,
        doctor_id: appt.doctor_id,
        chief_complaint: input.chief_complaint ?? null,
        diagnosis: input.diagnosis ?? null,
        prescription: input.prescription ?? null,
        notes: input.notes ?? null,
      },
      { onConflict: "appointment_id" },
    )
    .select()
    .single<ConsultationNote>();
  if (error) throw error;
  return data;
}

export async function getNote(appointmentId: string, actor: Actor) {
  const appt = await getAppointment(appointmentId);
  const role = actor.profile.role;
  const allowed =
    isStaff(role) ||
    (role === "doctor" && actor.id === appt.doctor_id) ||
    (role === "patient" && actor.id === appt.patient_id);
  if (!allowed) throw new HttpError(403, "Forbidden");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("consultation_notes")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle<ConsultationNote>();
  if (error) throw error;
  return data;
}
