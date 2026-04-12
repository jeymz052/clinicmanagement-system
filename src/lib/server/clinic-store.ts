import { promises as fs } from "node:fs";
import path from "node:path";
import {
  INITIAL_CONSULTATION_NOTES,
  INITIAL_PATIENTS,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_UNAVAILABILITY,
  type ConsultationNote,
  type DoctorUnavailability,
  type PatientRecordItem,
  type SystemSettings,
} from "@/src/lib/clinic";

const DATA_DIR = path.join(process.cwd(), "data");
const UNAVAILABILITY_FILE = path.join(DATA_DIR, "doctor-unavailability.json");
const PATIENTS_FILE = path.join(DATA_DIR, "patients.json");
const NOTES_FILE = path.join(DATA_DIR, "consultation-notes.json");
const SETTINGS_FILE = path.join(DATA_DIR, "system-settings.json");

async function ensureFile<T>(filePath: string, initialData: T) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(initialData, null, 2), "utf8");
  }
}

async function readJson<T>(filePath: string, initialData: T) {
  await ensureFile(filePath, initialData);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson<T>(filePath: string, value: T) {
  await ensureFile(filePath, value);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function readDoctorUnavailability() {
  return readJson<DoctorUnavailability[]>(UNAVAILABILITY_FILE, INITIAL_UNAVAILABILITY);
}

export async function addDoctorUnavailability(
  payload: Omit<DoctorUnavailability, "id">,
) {
  const current = await readDoctorUnavailability();
  const nextRecord: DoctorUnavailability = {
    ...payload,
    id: `blk-${String(current.length + 1).padStart(3, "0")}`,
  };
  const next = [...current, nextRecord];
  await writeJson(UNAVAILABILITY_FILE, next);
  return next;
}

export async function deleteDoctorUnavailability(id: string) {
  const current = await readDoctorUnavailability();
  const next = current.filter((record) => record.id !== id);
  await writeJson(UNAVAILABILITY_FILE, next);
  return next;
}

export async function readPatients() {
  return readJson<PatientRecordItem[]>(PATIENTS_FILE, INITIAL_PATIENTS);
}

export async function createPatient(payload: Omit<PatientRecordItem, "id" | "status">) {
  const current = await readPatients();
  const nextPatient: PatientRecordItem = {
    ...payload,
    id: `pat-${String(current.length + 1).padStart(3, "0")}`,
    status: "Active",
  };
  const next = [...current, nextPatient];
  await writeJson(PATIENTS_FILE, next);
  return next;
}

export async function updatePatient(updatedPatient: PatientRecordItem) {
  const current = await readPatients();
  const next = current.map((patient) =>
    patient.id === updatedPatient.id ? updatedPatient : patient,
  );
  await writeJson(PATIENTS_FILE, next);
  return next;
}

export async function deletePatient(id: string) {
  const current = await readPatients();
  const next = current.filter((patient) => patient.id !== id);
  await writeJson(PATIENTS_FILE, next);
  return next;
}

export async function readConsultationNotes() {
  return readJson<ConsultationNote[]>(NOTES_FILE, INITIAL_CONSULTATION_NOTES);
}

export async function upsertConsultationNote(
  payload: Omit<ConsultationNote, "id" | "updatedAt"> & { id?: string },
) {
  const current = await readConsultationNotes();
  const nextNote: ConsultationNote = {
    ...payload,
    id: payload.id ?? `note-${String(current.length + 1).padStart(3, "0")}`,
    updatedAt: new Date().toISOString(),
  };
  const exists = current.some((note) => note.id === nextNote.id);
  const next = exists
    ? current.map((note) => (note.id === nextNote.id ? nextNote : note))
    : [...current, nextNote];
  await writeJson(NOTES_FILE, next);
  return next;
}

export async function deleteConsultationNote(id: string) {
  const current = await readConsultationNotes();
  const next = current.filter((note) => note.id !== id);
  await writeJson(NOTES_FILE, next);
  return next;
}

export async function readSystemSettings() {
  return readJson<SystemSettings>(SETTINGS_FILE, INITIAL_SYSTEM_SETTINGS);
}

export async function saveSystemSettings(settings: SystemSettings) {
  await writeJson(SETTINGS_FILE, settings);
  return settings;
}
