export type AvailabilityReason = "Not Available" | "Leave";

export type DoctorUnavailability = {
  id: string;
  doctorId: string;
  date: string;
  reason: AvailabilityReason;
  note: string;
};

export type PatientRecordItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  isWalkIn: boolean;
  status: "Active" | "Inactive";
};

export type ConsultationProgress = "Ready" | "In Progress" | "Completed";

export type ConsultationNote = {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientName: string;
  note: string;
  prescription: string;
  status: ConsultationProgress;
  updatedAt: string;
};

export type SystemSettings = {
  clinicName: string;
  email: string;
  phone: string;
  address: string;
  onlineConsultationFee: number;
  maxPatientsPerHour: number;
  clinicOpenTime: string;
  clinicCloseTime: string;
};

// All clinic data now lives in Supabase. Only INITIAL_SYSTEM_SETTINGS remains
// as an in-memory default returned if the system_settings row is missing.
export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  clinicName: "Chiara Clinic",
  email: "admin@chiara.test",
  phone: "+1 (555) 123-4567",
  address: "123 Medical Avenue",
  onlineConsultationFee: 120,
  maxPatientsPerHour: 5,
  clinicOpenTime: "08:00",
  clinicCloseTime: "17:00",
};
