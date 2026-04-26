export type DbRole =
  | "super_admin"
  | "admin"
  | "secretary"
  | "doctor"
  | "patient";

export type ApptType = "Clinic" | "Online";
export type ScheduleMode = "Clinic" | "Online" | "Both";

export type ApptStatus =
  | "PendingApproval"
  | "PendingPayment"
  | "Confirmed"
  | "InProgress"
  | "Completed"
  | "Cancelled"
  | "NoShow";

export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";

export type PaymentMethod = "Cash" | "GCash" | "QR" | "Card" | "BankTransfer";

export type BillingStatus = "Draft" | "Issued" | "Paid" | "Void";

export type NotificationChannel = "email" | "sms";

export type Profile = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: DbRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Doctor = {
  id: string;
  specialty: string;
  license_no: string;
  consultation_fee_clinic: number;
  consultation_fee_online: number;
};

export type DoctorSchedule = {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  schedule_mode: ScheduleMode;
  is_active: boolean;
};

export type DoctorUnavailability = {
  id: string;
  doctor_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: ApptType;
  status: ApptStatus;
  queue_number: number;
  reason: string;
  meeting_link: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  appointment_id: string | null;
  billing_id: string | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  provider: string | null;
  provider_ref: string | null;
  paid_at: string | null;
  created_at: string;
};

export type OnlineBookingReservation = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  queue_number: number;
  reason: string;
  amount: number;
  status: "Pending" | "Paid" | "Failed" | "Expired" | "Converted";
  payment_provider: string | null;
  payment_ref: string | null;
  appointment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Billing = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: BillingStatus;
  issued_at: string | null;
  created_at: string;
};

export type BillingItem = {
  id: string;
  billing_id: string;
  pricing_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type ConsultationNote = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  prescription: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
