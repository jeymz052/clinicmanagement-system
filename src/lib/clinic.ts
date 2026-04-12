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
  emergencyContact: string;
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
};

export const INITIAL_UNAVAILABILITY: DoctorUnavailability[] = [
  {
    id: "blk-001",
    doctorId: "omar-reed",
    date: "2026-04-15",
    reason: "Leave",
    note: "Annual leave",
  },
];

export const INITIAL_PATIENTS: PatientRecordItem[] = [
  {
    id: "pat-001",
    fullName: "John Doe",
    email: "john@example.com",
    phone: "+1 (555) 010-1001",
    dateOfBirth: "1989-03-15",
    gender: "Male",
    address: "12 Maple Street",
    emergencyContact: "+1 (555) 010-2001",
    isWalkIn: false,
    status: "Active",
  },
  {
    id: "pat-002",
    fullName: "Maria Santos",
    email: "maria@example.com",
    phone: "+1 (555) 010-1002",
    dateOfBirth: "1992-07-21",
    gender: "Female",
    address: "88 Green Avenue",
    emergencyContact: "+1 (555) 010-2002",
    isWalkIn: false,
    status: "Active",
  },
  {
    id: "pat-003",
    fullName: "Paul Tan",
    email: "paul@example.com",
    phone: "+1 (555) 010-1005",
    dateOfBirth: "1978-11-03",
    gender: "Male",
    address: "7 Pine Close",
    emergencyContact: "+1 (555) 010-2005",
    isWalkIn: true,
    status: "Active",
  },
];

export const INITIAL_CONSULTATION_NOTES: ConsultationNote[] = [
  {
    id: "note-001",
    appointmentId: "apt-001",
    doctorId: "lina-fox",
    patientName: "John Doe",
    note: "Blood pressure stable. Continue current medication.",
    prescription: "Losartan 50mg daily",
    status: "Completed",
    updatedAt: "2026-04-11T09:00:00.000Z",
  },
];

export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  clinicName: "Chiara Clinic",
  email: "admin@chiara.test",
  phone: "+1 (555) 123-4567",
  address: "123 Medical Avenue",
  onlineConsultationFee: 120,
  maxPatientsPerHour: 5,
};
