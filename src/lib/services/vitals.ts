import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor, isStaff } from "@/src/lib/http";
import type { VitalSigns } from "@/src/lib/db/types";
import { getAppointment } from "@/src/lib/services/booking";

// All numeric inputs nullable so a partial save (e.g. just BP + temp at
// triage) is valid. Service-side validation here matches the DB CHECK
// constraints in supabase/migrations/20260508_vital_signs.sql so we fail
// fast with a friendly 400 instead of relying on a Postgres "violates
// check constraint" error to bubble up.
export type VitalSignsInput = {
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  temperature_c?: number | null;
  pulse_rate?: number | null;
  oxygen_saturation?: number | null;
  respiratory_rate?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  notes?: string | null;
};

type FieldRule = {
  key: keyof VitalSignsInput;
  label: string;
  min: number;
  max: number;
};

// Ranges intentionally generous (physiologically plausible, not just
// "normal") — the doctor must be able to record an emergency reading.
const NUMERIC_RULES: FieldRule[] = [
  { key: "bp_systolic", label: "Systolic BP", min: 0, max: 300 },
  { key: "bp_diastolic", label: "Diastolic BP", min: 0, max: 200 },
  { key: "temperature_c", label: "Temperature", min: 25, max: 45 },
  { key: "pulse_rate", label: "Pulse rate", min: 0, max: 300 },
  { key: "oxygen_saturation", label: "SpO2", min: 0, max: 100 },
  { key: "respiratory_rate", label: "Respiratory rate", min: 0, max: 100 },
  { key: "weight_kg", label: "Weight", min: 0, max: 600 },
  { key: "height_cm", label: "Height", min: 0, max: 300 },
];

function validate(input: VitalSignsInput) {
  for (const rule of NUMERIC_RULES) {
    const v = input[rule.key];
    if (v === null || v === undefined) continue;
    if (typeof v !== "number" || Number.isNaN(v)) {
      throw new HttpError(400, `${rule.label} must be a number`);
    }
    if (v < rule.min || v > rule.max) {
      throw new HttpError(
        400,
        `${rule.label} must be between ${rule.min} and ${rule.max}`,
      );
    }
  }
}

async function ensureAccess(appointmentId: string, actor: Actor) {
  const appt = await getAppointment(appointmentId);
  const role = actor.profile.role;
  const allowed = isStaff(role) || (role === "doctor" && actor.id === appt.doctor_id);
  if (!allowed) throw new HttpError(403, "Only clinic staff or the assigned doctor can record vitals");
  return appt;
}

export async function getVitals(appointmentId: string, actor: Actor): Promise<VitalSigns | null> {
  const appt = await getAppointment(appointmentId);
  const role = actor.profile.role;
  // Read access is broader than write: the patient who owns the appointment
  // can also see their own vitals (so we can show them on their profile /
  // history later). Mirrors the SELECT policy in schema.sql.
  const allowed =
    isStaff(role)
    || (role === "doctor" && actor.id === appt.doctor_id)
    || (role === "patient" && actor.id === appt.patient_id);
  if (!allowed) throw new HttpError(403, "Forbidden");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("vital_signs")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle<VitalSigns>();
  if (error) throw error;
  return data;
}

export async function upsertVitals(
  appointmentId: string,
  input: VitalSignsInput,
  actor: Actor,
): Promise<VitalSigns> {
  const appt = await ensureAccess(appointmentId, actor);
  validate(input);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("vital_signs")
    .upsert(
      {
        appointment_id: appt.id,
        recorded_by: actor.id,
        bp_systolic: input.bp_systolic ?? null,
        bp_diastolic: input.bp_diastolic ?? null,
        temperature_c: input.temperature_c ?? null,
        pulse_rate: input.pulse_rate ?? null,
        oxygen_saturation: input.oxygen_saturation ?? null,
        respiratory_rate: input.respiratory_rate ?? null,
        weight_kg: input.weight_kg ?? null,
        height_cm: input.height_cm ?? null,
        notes: input.notes ?? null,
      },
      { onConflict: "appointment_id" },
    )
    .select()
    .single<VitalSigns>();
  if (error) throw error;
  return data;
}
