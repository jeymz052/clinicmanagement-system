"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo, useState, useEffect, useTransition } from "react";
import { createAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { SharedSlotPicker } from "@/src/components/appointments/SharedSlotPicker";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useAppointmentAvailability } from "@/src/components/appointments/useAppointmentAvailability";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { useDoctorFees } from "@/src/components/clinic/useDoctorFees";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  addDays,
  formatDisplayDate,
  formatRange,
  getDoctorById,
  getWeekDates,
  type AppointmentType,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";
import {
  ONLINE_CONSULTATION_HOURLY_RATE,
  calculateConsultationCharge,
  calculateOnlineConsultationCharge,
  formatDurationLabel,
} from "@/src/lib/consultation-pricing";

type BookingForm = {
  patientName: string;
  email: string;
  phone: string;
  doctorId: string;
  date: string;
  start: string;
  type: AppointmentType;
  reason: string;
  durationMinutes: "60";
  paymentOption: OnlinePaymentOption;
};

type OnlinePaymentOption =
  | "paymongo_gcash"
  | "paymongo_card"
  | "stripe_card"
  | "bank_transfer";

const today = getClinicToday();
const DEFAULT_DOCTOR_ID = "chiara-punzalan";

const INITIAL_FORM: BookingForm = {
  patientName: "",
  email: "",
  phone: "",
  doctorId: DEFAULT_DOCTOR_ID,
  date: today,
  start: "",
  type: "Clinic",
  reason: "",
  durationMinutes: "60",
  paymentOption: "paymongo_gcash",
};

const ONLINE_PAYMENT_OPTIONS: Array<{
  value: OnlinePaymentOption;
  label: string;
  detail: string;
}> = [
  {
    value: "paymongo_gcash",
    label: "QR / GCash",
    detail: "Pay online using GCash or a local QR-supported wallet.",
  },
  {
    value: "paymongo_card",
    label: "Card via PayMongo",
    detail: "Use a debit or credit card through PayMongo checkout.",
  },
  {
    value: "stripe_card",
    label: "Card via Stripe",
    detail: "Use a debit or credit card through Stripe checkout.",
  },
  {
    value: "bank_transfer",
    label: "Bank Transfer",
    detail: "Manual verification by clinic staff. Appointment confirms only after payment is verified.",
  },
];

function paymentOptionLabel(option: OnlinePaymentOption) {
  return ONLINE_PAYMENT_OPTIONS.find((item) => item.value === option)?.label ?? "Online payment";
}

export default function BookAppointmentPage() {
  const pathname = usePathname();
  const requiresAuthForReview = pathname === "/";
  const { accessToken, role, user, profile } = useRole();
  const { setAppointments, isLoading, error } = useAppointments();
  const { doctors } = useDoctors();
  const [formData, setFormData] = useState<BookingForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [visibleWeekStart, setVisibleWeekStart] = useState(today);

  const primaryDoctor = doctors[0] ?? null;
  const activeDoctorId = primaryDoctor?.slug ?? DEFAULT_DOCTOR_ID;
  const selectedDoctor = primaryDoctor ?? getDoctorById(activeDoctorId);
  const { fees } = useDoctorFees(activeDoctorId);
  const {
    slotStatuses,
    blockedReason,
    nextAvailableSlot,
    isLoading: availabilityLoading,
    error: availabilityError,
  } = useAppointmentAvailability(activeDoctorId, formData.date, formData.type);
  const selectedSlot = slotStatuses.find((slot) => slot.start === formData.start) ?? null;
  const estimatedFee = selectedSlot
    ? formData.type === "Online"
      ? calculateOnlineConsultationCharge(selectedSlot.start, selectedSlot.end)
      : calculateConsultationCharge(fees.clinic, selectedSlot.start, selectedSlot.end)
    : formData.type === "Online"
      ? ONLINE_CONSULTATION_HOURLY_RATE
      : fees.clinic;
  const selectedSlotDuration = selectedSlot
    ? formatDurationLabel(selectedSlot.start, selectedSlot.end)
    : "1 hr";

  const BOOKING_STEP_LABELS = [
    "Service & Doctor",
    "Patient Information",
    "Date & Time",
    "Review & Payment",
  ] as const;

  const calendarWeekStart = useMemo(() => {
    const datesInView = getWeekDates(visibleWeekStart);
    const lastDateInView = datesInView[datesInView.length - 1];
    if (formData.date < visibleWeekStart || formData.date > lastDateInView) {
      return formData.date;
    }
    return visibleWeekStart;
  }, [formData.date, visibleWeekStart]);
  const weekDates = useMemo(() => getWeekDates(calendarWeekStart), [calendarWeekStart]);
  const [activeStep, setActiveStep] = useState(1);

  // Restore any saved draft / reservation after auth or page reload
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bookingDraft");
      if (raw) {
        const parsed = JSON.parse(raw) as { formData?: Partial<BookingForm>; activeStep?: number };
        if (parsed?.formData) {
          setFormData((cur) => ({ ...cur, ...parsed.formData }));
        }
        if (parsed?.activeStep) {
          if (requiresAuthForReview && parsed.activeStep === 4 && !accessToken) {
            setActiveStep(3);
          } else {
            setActiveStep(parsed.activeStep);
          }
        }
      }
      const reservationId = localStorage.getItem("bookingReservation");
      if (reservationId) {
        setFeedback({ message: "We held your selected slot — please sign in to complete booking.", type: "success" });
      }
    } catch {
      // ignore
    }
  }, [accessToken, requiresAuthForReview]);

  const patientDefaults = useMemo(
    () => ({
      patientName:
        profile?.full_name?.trim() ||
        user?.user_metadata?.full_name ||
        "",
      email: profile?.email || user?.email || "",
      phone: profile?.phone || "",
    }),
    [profile, user],
  );
  const effectivePatientName =
    role === "PATIENT" ? formData.patientName || patientDefaults.patientName : formData.patientName;
  const effectivePatientEmail =
    role === "PATIENT" ? formData.email || patientDefaults.email : formData.email;
  const effectivePatientPhone =
    role === "PATIENT" ? formData.phone || patientDefaults.phone : formData.phone;

  const step1Valid = !!formData.type;
  const step2Valid =
    !!effectivePatientName.trim() && !!effectivePatientEmail.trim() && !!effectivePatientPhone.trim();
  const datePicked = !!formData.date && !blockedReason;
  const step3Valid = datePicked && !!formData.start;
  const step4Done = step1Valid && step2Valid && step3Valid;

  function canAccessStep(step: number): boolean {
    if (step === 1) return true;
    if (step === 2) return step1Valid;
    if (step === 3) return step1Valid && step2Valid;
    if (step === 4) return step1Valid && step2Valid && step3Valid;
    return false;
  }

  function goToStep(step: number) {
    if (step < 1 || step > BOOKING_STEP_LABELS.length) return;
    if (!canAccessStep(step)) return;
    setActiveStep(step);
  }

  function goNext() {
    if (activeStep === 1 && step1Valid) goToStep(2);
    else if (activeStep === 2 && step2Valid) goToStep(3);
    else if (activeStep === 3 && step3Valid) {
      goToStep(4);
    }
  }

  function goBack() {
    if (activeStep > 1) setActiveStep((s) => s - 1);
  }

  function updateForm<K extends keyof BookingForm>(field: K, value: BookingForm[K]) {
    setFormData((current) => {
      const nextState = { ...current, [field]: value };
      if (field === "doctorId" || field === "date" || field === "type") {
        nextState.start = "";
      }
      return nextState;
    });
    setFeedback(null);
  }

  async function startOnlinePayment() {
    if (!accessToken) {
      throw new Error("Your session expired. Please sign in again.");
    }

    const reservationId = typeof window !== "undefined" ? localStorage.getItem("bookingReservation") : null;

    const checkoutRes = await fetch("/api/v2/payments/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        patientName: effectivePatientName,
        email: effectivePatientEmail,
        phone: effectivePatientPhone,
        doctorId: activeDoctorId,
        date: formData.date,
        start: formData.start,
        reason: formData.reason,
        type: "Online",
        reservation_id: reservationId ?? undefined,
        payment_option: formData.paymentOption,
      }),
    });

    const payload = (await checkoutRes.json().catch(() => ({}))) as {
      url?: string | null;
      message?: string;
      reservation_id?: string;
      checkout_mode?: "redirect" | "manual";
      instructions?: string;
      payment_reference?: string;
    };
    if (!checkoutRes.ok) {
      throw new Error(payload.message ?? "Unable to start online payment.");
    }

    if (payload.reservation_id) {
      try {
        localStorage.setItem("bookingReservation", payload.reservation_id);
      } catch {
        // ignore storage errors
      }
    }

    return payload;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeStep !== 4) return;
    
    // CRITICAL: Block submission without authentication
    if (!accessToken || !user || !profile) {
      console.warn("[BookAppointment] Submission blocked: not authenticated", { accessToken: !!accessToken, user: !!user, profile: !!profile });
      setFeedback({ message: "❌ You must sign in or create an account to complete your booking.", type: "error" });
      return;
    }

    startSubmitTransition(async () => {
      if (formData.type === "Online") {
        try {
          const paymentStart = await startOnlinePayment();
          if (paymentStart.checkout_mode === "manual") {
            try {
              localStorage.removeItem("bookingDraft");
            } catch {
              // ignore storage errors
            }

            setFeedback({
              message: paymentStart.payment_reference
                ? `Bank transfer request created. Reference ${paymentStart.payment_reference}. ${paymentStart.instructions ?? "Wait for clinic staff to verify your payment before the appointment is confirmed."}`
                : paymentStart.instructions ?? "Bank transfer request created. Wait for clinic staff to verify your payment before the appointment is confirmed.",
              type: "success",
            });
            setFormData({ ...INITIAL_FORM, doctorId: activeDoctorId, type: "Online" });
            setVisibleWeekStart(today);
            setActiveStep(1);
            return;
          }

          if (!paymentStart.url) {
            throw new Error("Payment checkout link was not returned.");
          }

          window.location.href = paymentStart.url;
        } catch (paymentError) {
          setFeedback({
            message: paymentError instanceof Error ? paymentError.message : "Unable to start online payment.",
            type: "error",
          });
        }
        return;
      }

      const result = await createAppointmentAction(accessToken, {
        patientName: effectivePatientName,
        email: effectivePatientEmail,
        phone: effectivePatientPhone,
        doctorId: activeDoctorId,
        date: formData.date,
        start: formData.start,
        type: formData.type,
        reason: formData.reason,
      });

      setAppointments(result.appointments);

      if (!result.ok) {
        setFeedback({ message: result.message, type: "error" });
        return;
      }
      setFormData({ ...INITIAL_FORM, type: formData.type, doctorId: activeDoctorId });
      setVisibleWeekStart(today);
      setActiveStep(1);
      try {
        localStorage.removeItem("bookingDraft");
        localStorage.removeItem("bookingReservation");
      } catch {
        // ignore storage errors
      }
      setFeedback({
        message: `Booked! ${result.appointment.patientName} with ${selectedDoctor?.name ?? "doctor"} on ${formatDisplayDate(result.appointment.date)} at ${formatRange(result.appointment.start, result.appointment.end)}. Queue #${result.appointment.queueNumber}.${formData.type === "Clinic" ? " Clinic appointment confirmed." : ""}`,
        type: "success",
      });
    });
  }

  return (
    <div className="space-y-6 overflow-x-hidden pb-8">
      <div className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),radial-gradient(circle_at_85%_15%,_rgba(34,197,94,0.18),_transparent_20%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-4 shadow-[0_30px_80px_rgba(16,185,129,0.12)] sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Appointment Booking</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Book your visit in minutes</h1>
          </div>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto lg:min-w-0">
            <StatCard label="Total" value={0} color="slate" />
            <StatCard label="Clinic" value={0} color="teal" />
            <StatCard label="Online" value={0} color="sky" />
            <StatCard label="Pending Action" value={0} color="amber" />
          </div>
        </div>
      </div>

      {feedback ? (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${
          feedback.type === "success"
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border border-red-200 bg-red-50 text-red-800"
        }`}>
          {feedback.message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {availabilityError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{availabilityError}</div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="rounded-[2rem] border border-emerald-100 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5">
          <HorizontalBookingStepper
            labels={BOOKING_STEP_LABELS}
            activeStep={activeStep}
            onStepClick={goToStep}
          />
        </div>

        <div className="mt-6 space-y-5">
          {activeStep === 1 ? (
            <>
              <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-[0_20px_45px_rgba(16,185,129,0.08)] sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 1 of 4</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Choose Your Visit Type</h2>
                    <p className="mt-2 text-sm text-slate-600">Select whether you&apos;d like an in-person clinic visit or online consultation</p>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2.5 rounded-full border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#d1fae5)] px-4 py-2.5 text-xs font-semibold text-emerald-800 shadow-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    {selectedDoctor?.name ?? "Dra. Chiara C. Punzalan M.D."}
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(["Clinic", "Online"] as AppointmentType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm("type", type)}
                      className={`group overflow-hidden rounded-[1.75rem] border p-6 text-left transition-all duration-300 ${
                        formData.type === type
                          ? type === "Clinic"
                            ? "border-emerald-500 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] shadow-[0_20px_35px_rgba(16,185,129,0.16)]"
                            : "border-teal-500 bg-[linear-gradient(180deg,#f0fdfa_0%,#ccfbf1_100%)] shadow-[0_20px_35px_rgba(13,148,136,0.14)]"
                          : "border-emerald-100 bg-white hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_18px_32px_rgba(16,185,129,0.10)]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`rounded-2xl p-3.5 transition-transform duration-300 group-hover:scale-110 ${
                          formData.type === type
                            ? type === "Clinic" ? "bg-white/80" : "bg-white/75"
                            : "bg-emerald-50"
                        }`}>
                          {type === "Clinic" ? (
                            <svg className={`h-7 w-7 ${formData.type === type ? "text-emerald-700" : "text-emerald-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          ) : (
                            <svg className={`h-7 w-7 ${formData.type === type ? "text-teal-700" : "text-teal-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`text-lg font-bold ${formData.type === type ? "text-slate-900" : "text-slate-700"}`}>
                                {type === "Clinic" ? "Clinic Visit" : "Online Consultation"}
                              </p>
                              <p className={`mt-2 text-sm ${formData.type === type ? "text-slate-700" : "text-slate-600"}`}>
                                {type === "Clinic" 
                                  ? "Visit our clinic for an in-person consultation" 
                                  : "Video consultation from the comfort of your home"}
                              </p>
                            </div>
                            <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                              formData.type === type
                                ? type === "Clinic"
                                  ? "bg-white/80 text-emerald-700"
                                  : "bg-white/80 text-teal-700"
                                : "bg-emerald-50 text-emerald-600"
                            }`}>
                              {formData.type === type ? "Selected" : "Choose"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-5.5 shadow-sm">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Selected Doctor</label>
                    <div className="mt-4 w-full rounded-[1.4rem] border-2 border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)] px-4 py-4 text-base font-bold text-slate-900 shadow-sm">
                      {selectedDoctor?.name ?? "Dra. Chiara C. Punzalan M.D."}
                    </div>
                    {selectedDoctor?.specialty && (
                      <p className="mt-2.5 text-sm text-slate-600">
                        <span className="text-emerald-700 font-semibold">{selectedDoctor.specialty}</span>
                      </p>
                    )}
                  </div>

                  <div className="rounded-[1.75rem] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#dcfce7_100%)] p-5.5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Consultation Rates</p>
                    <p className="mt-3 text-lg font-bold text-slate-900">{selectedDoctor?.name ?? "Your Doctor"}</p>
                    {selectedDoctor?.specialty && (
                      <p className="mt-1 text-sm text-slate-700 font-medium">{selectedDoctor.specialty}</p>
                    )}
                    <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                      <div className="rounded-[1.2rem] border border-white/70 bg-white/80 px-3.5 py-3.5 shadow-sm">
                        <p className="text-slate-600 font-medium">Clinic / Hr</p>
                        <p className="mt-2.5 text-xl font-bold text-slate-900">PHP {fees.clinic.toLocaleString()}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/70 bg-white/80 px-3.5 py-3.5 shadow-sm">
                        <p className="text-slate-600 font-medium">Online / Hr</p>
                        <p className="mt-2.5 text-xl font-bold text-slate-900">PHP {ONLINE_CONSULTATION_HOURLY_RATE.toLocaleString()}</p>
                      </div>
                    </div>
                    {formData.type === "Online" ? (
                      <div className="mt-3.5 rounded-[1.2rem] border border-white/70 bg-white/80 px-3.5 py-3.5 shadow-sm">
                        <label htmlFor="duration" className="text-slate-600 font-medium text-xs">Duration</label>
                        <select
                          id="duration"
                          value={formData.durationMinutes}
                          onChange={(event) => updateForm("durationMinutes", event.target.value as "60")}
                          className="mt-2.5 w-full rounded-[1rem] border border-emerald-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 cursor-pointer"
                        >
                          <option value="60">1 hour - PHP 350</option>
                        </select>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <WizardNav showBack={false} onNext={goNext} nextDisabled={!step1Valid} nextLabel="Next: Patient Info" />
            </>
          ) : null}

          {activeStep === 2 ? (
            <>
              <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-[0_20px_45px_rgba(16,185,129,0.08)] sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 2 of 4</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Patient Information</h2>
                    <p className="mt-1 text-sm text-slate-600">Please provide your contact details for the appointment</p>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    All fields required
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-3 sm:col-span-2">
                    <label htmlFor="fullname" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Full Name *</label>
                    <input 
                      id="fullname"
                      type="text" 
                      value={effectivePatientName} 
                      onChange={(e) => updateForm("patientName", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:bg-emerald-50/30 focus:ring-4 focus:ring-emerald-200" 
                      placeholder="e.g., Juan Dela Cruz" 
                      autoComplete="name" 
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Email *</label>
                    <input 
                      id="email"
                      type="email" 
                      value={effectivePatientEmail} 
                      onChange={(e) => updateForm("email", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:bg-emerald-50/30 focus:ring-4 focus:ring-emerald-200" 
                      placeholder="juan@email.com" 
                      autoComplete="email" 
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Phone *</label>
                    <input 
                      id="phone"
                      type="tel" 
                      value={effectivePatientPhone} 
                      onChange={(e) => updateForm("phone", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:bg-emerald-50/30 focus:ring-4 focus:ring-emerald-200" 
                      placeholder="+63 912 345 6789" 
                      autoComplete="tel" 
                    />
                  </div>
                  <div className="lg:col-span-3 sm:col-span-2">
                    <label htmlFor="reason" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Reason for Visit <span className="font-normal text-slate-500">(Optional)</span></label>
                    <input 
                      id="reason"
                      type="text" 
                      value={formData.reason} 
                      onChange={(e) => updateForm("reason", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:bg-emerald-50/30 focus:ring-4 focus:ring-emerald-200" 
                      placeholder="e.g., Follow-up checkup, Dental cleaning, Consultation" 
                    />
                  </div>
                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step2Valid} nextLabel="Continue to Date & Time" />
            </>
          ) : null}

          {activeStep === 3 ? (
            <>
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_24rem]">
                <div className="space-y-5">
                  <div className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-[0_20px_45px_rgba(16,185,129,0.08)] sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 3 of 4</p>
                        <h2 className="mt-2 text-xl font-bold text-slate-900">Select Date & Time</h2>
                        <p className="mt-1 text-sm text-slate-600">Choose your preferred appointment date and time slot</p>
                      </div>
                      {nextAvailableSlot ? (
                        <button
                          type="button"
                          onClick={() => {
                            updateForm("date", nextAvailableSlot.date);
                            updateForm("start", nextAvailableSlot.slot.start);
                          }}
                          className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 hover:border-emerald-300"
                        >
                          ⚡ Next: {formatDisplayDate(nextAvailableSlot.date)} {formatRange(nextAvailableSlot.slot.start, nextAvailableSlot.slot.end)}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(180deg,#fafffb_0%,#eefcf2_100%)] p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Calendar Selection</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart((current) => {
                              const candidate = addDays(current, -7);
                              return candidate < today ? today : candidate;
                            })}
                            disabled={calendarWeekStart <= today}
                            className="rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100"
                          >
                            ← Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart(addDays(calendarWeekStart, 7))}
                            className="rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                          >
                            Next →
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                        {weekDates.map((date) => {
                          const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${date}T00:00:00`));
                          const isSelected = formData.date === date;
                          return (
                            <button
                              key={date}
                              type="button"
                              onClick={() => updateForm("date", date)}
                              className={`group rounded-[1.35rem] border px-3 py-3.5 text-left transition-all duration-200 ${
                                isSelected
                                  ? "border-emerald-500 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] shadow-[0_12px_24px_rgba(16,185,129,0.12)]"
                                  : "border-emerald-100 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-[0_8px_16px_rgba(16,185,129,0.08)]"
                              }`}
                            >
                              <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isSelected ? "text-emerald-700" : "text-slate-500"}`}>{dayLabel}</p>
                              <p className={`mt-2 text-sm font-bold ${isSelected ? "text-emerald-900" : "text-slate-900"}`}>{formatDisplayDate(date)}</p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-emerald-100">
                        <label htmlFor="datepicker" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Or pick a specific date</label>
                        <input 
                          id="datepicker"
                          type="date" 
                          value={formData.date} 
                          min={today} 
                          onChange={(e) => updateForm("date", e.target.value)} 
                          className="w-full sm:w-auto rounded-[1.1rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-200 cursor-pointer" 
                        />
                      </div>
                    </div>

                    {blockedReason ? (
                      <div className="mt-5 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700 shadow-sm font-medium">
                        {blockedReason}
                      </div>
                    ) : null}
                  </div>

                  <SharedSlotPicker
                    slotStatuses={slotStatuses}
                    selectedStart={formData.start}
                    onSelect={(start) => updateForm("start", start)}
                    disabled={isLoading || isSubmitting}
                    loading={availabilityLoading}
                  />
                </div>

                <div className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-[0_20px_45px_rgba(16,185,129,0.08)] h-fit sm:p-5 lg:sticky lg:top-24">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">📋 Booking Summary</p>
                  
                  <div className="mt-4 rounded-[1.5rem] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] p-4.5 shadow-sm">
                    <div className="space-y-3">
                      <SummaryRow label="Visit Type" value={formData.type === "Clinic" ? "🏥 Clinic Visit" : "💻 Online Consultation"} done />
                      <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                      <div className="h-[1px] bg-gradient-to-r from-emerald-200 to-transparent my-2" />
                      <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={!!formData.date} />
                      <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Choose a slot"} done={!!selectedSlot} />
                      <SummaryRow label="Duration" value={selectedSlot ? selectedSlotDuration : "-"} done={!!selectedSlot} />
                      <div className="h-[1px] bg-gradient-to-r from-emerald-200 to-transparent my-2" />
                      <SummaryRow label="Queue #" value={selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "—"} done={!!selectedSlot} />
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] border-2 border-emerald-500 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] px-4 py-4 shadow-md">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Estimated Fee</p>
                    <p className="mt-2.5 text-3xl font-black text-emerald-900">
                      PHP {estimatedFee.toLocaleString()}
                    </p>
                    <p className="mt-1.5 text-xs text-emerald-700 font-medium">for {selectedSlotDuration}</p>
                  </div>

                  {formData.type === "Online" ? (
                    <div className="mt-4 rounded-[1.4rem] border border-sky-200 bg-sky-50 px-3.5 py-3.5 text-xs">
                      <p className="font-semibold text-sky-900">💳 Payment Info</p>
                      <p className="mt-1.5 text-sky-800">Online consultations require payment first. You&apos;ll choose QR, card, or bank transfer on the review step.</p>
                    </div>
                  ) : null}

                  {requiresAuthForReview && !accessToken && (
                    <div className="mt-4 rounded-[1.4rem] border border-emerald-300 bg-emerald-50 px-3.5 py-3.5">
                      <p className="text-xs font-semibold text-emerald-700 mb-2">🔐 Sign In Required</p>
                      <p className="text-xs text-emerald-700 mb-3">Please sign in or create an account to proceed to the next step.</p>
                      <div className="flex gap-2 flex-col">
                        <Link href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}#booking`} className="w-full rounded-full bg-emerald-600 text-white px-3 py-2 text-xs font-semibold text-center transition hover:bg-emerald-700">
                          Sign In
                        </Link>
                        <Link href={`/register?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}#booking`} className="w-full rounded-full border border-emerald-300 bg-white text-emerald-700 px-3 py-2 text-xs font-semibold text-center transition hover:bg-emerald-50">
                          Sign Up
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step3Valid} nextLabel="Review & Confirm" />
            </>
          ) : null}

          {activeStep === 4 ? (
            <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f6fef9_100%)] p-4 shadow-[0_22px_48px_rgba(16,185,129,0.08)] sm:p-6">
              {requiresAuthForReview ? (
                <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-emerald-300 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] p-6 shadow-sm sm:p-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Step 4 of 4</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Please sign in to continue</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Sign in or create an account to review and complete your appointment booking.
                  </p>

                  <div className="mt-6 rounded-[1.4rem] border border-emerald-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
                    You can keep your selected service, date, and time. You only need to sign in or sign up before the final confirmation.
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={`/login?next=${encodeURIComponent(`${pathname}#booking`)}`}
                      className="flex-1 rounded-full bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Sign In
                    </Link>
                    <Link
                      href={`/register?next=${encodeURIComponent(`${pathname}#booking`)}`}
                      className="flex-1 rounded-full border border-emerald-300 bg-white px-5 py-3 text-center text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      Sign Up
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 4 of 4</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {formData.type === "Online" ? "Review & Proceed to Payment" : "Review & Confirm"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">Please review your appointment details before confirming</p>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                    <div className="space-y-4 rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] p-5.5 shadow-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-3">📋 Appointment Details</p>
                        <div className="space-y-3">
                          <SummaryRow label="Visit Type" value={formData.type === "Clinic" ? "🏥 Clinic Visit" : "💻 Online Consultation"} done />
                          <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                          <div className="h-[1px] bg-gradient-to-r from-emerald-200 to-transparent" />
                          <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={datePicked} />
                          <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "-"} done={step3Valid} />
                          <SummaryRow label="Duration" value={selectedSlot ? selectedSlotDuration : "-"} done={step3Valid} />
                          {selectedSlot ? <SummaryRow label="Queue #" value={`#${selectedSlot.nextQueueNumber}`} done /> : null}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-3">👤 Patient Information</p>
                        <div className="space-y-3 text-sm">
                          <SummaryRow label="Name" value={effectivePatientName} done={step2Valid} />
                          <SummaryRow label="Email" value={effectivePatientEmail} done={step2Valid} />
                          <SummaryRow label="Phone" value={effectivePatientPhone} done={step2Valid} />
                          {formData.reason ? <SummaryRow label="Reason" value={formData.reason} done /> : null}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-3">Payment Info</p>
                        <SummaryRow
                          label={formData.type === "Online" ? "Amount Due" : "Payable After"}
                          value={`PHP ${estimatedFee.toLocaleString()}`}
                          done
                        />
                        {formData.type === "Online" ? (
                          <SummaryRow
                            label="Payment Method"
                            value={paymentOptionLabel(formData.paymentOption)}
                            done
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border-2 border-emerald-500 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-5.5 shadow-md h-fit lg:sticky lg:top-24">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        {formData.type === "Online" ? "💳 Ready for Payment" : "✅ Ready to Book"}
                      </p>
                      <p className="mt-4 text-3xl font-black text-emerald-900">
                        {formData.type === "Online"
                          ? "Pay Now"
                          : `Queue ${selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "--"}`}
                      </p>
                      <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                        {formData.type === "Online"
                          ? formData.paymentOption === "bank_transfer"
                            ? "Your booking will stay pending until the clinic verifies the bank transfer."
                            : "You will be directed to the selected payment gateway to complete the payment."
                          : selectedSlot
                            ? `Your appointment is confirmed for ${formatRange(selectedSlot.start, selectedSlot.end)}`
                            : "Select a time slot first"}
                      </p>

                      <div className="mt-5 rounded-[1.4rem] border-2 border-emerald-300 bg-emerald-50 px-4 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          {formData.type === "Online" ? `Amount due (${selectedSlotDuration})` : `Consultation fee (${selectedSlotDuration})`}
                        </p>
                        <p className="mt-2.5 text-3xl font-black text-emerald-900">
                          PHP {estimatedFee.toLocaleString()}
                        </p>
                      </div>

                      {formData.type === "Online" ? (
                        <div className="mt-4 space-y-3 rounded-[1.4rem] border border-sky-200 bg-sky-50 px-4 py-4">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-semibold text-sky-900">Choose Payment Option</span>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-sky-700 shadow-sm border border-sky-200">
                              Pay first
                            </span>
                          </div>
                          <div className="space-y-2">
                            {ONLINE_PAYMENT_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => updateForm("paymentOption", option.value)}
                                className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                  formData.paymentOption === option.value
                                    ? "border-sky-500 bg-white shadow-sm"
                                    : "border-sky-100 bg-white/70 hover:border-sky-300"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                                    <p className="mt-1 text-xs text-slate-600">{option.detail}</p>
                                  </div>
                                  <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                                    formData.paymentOption === option.value
                                      ? "border-sky-500 bg-sky-500 text-white"
                                      : "border-slate-300 text-slate-400"
                                  }`}>
                                    {formData.paymentOption === option.value ? "✓" : ""}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!requiresAuthForReview && !accessToken && (
                    <div className="rounded-[1.4rem] border border-emerald-300 bg-emerald-50 px-4 py-4">
                      <p className="text-sm font-semibold text-emerald-700 mb-3">🔐 Sign In Required</p>
                      <p className="text-sm text-emerald-700 mb-4">You must sign in or create an account to complete your booking.</p>
                      <div className="flex gap-3 flex-col sm:flex-row">
                        <Link href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}#booking`} className="flex-1 rounded-full bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold text-center transition hover:bg-emerald-700">
                          Sign In
                        </Link>
                        <Link href={`/register?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}#booking`} className="flex-1 rounded-full border border-emerald-300 bg-white text-emerald-700 px-4 py-2.5 text-sm font-semibold text-center transition hover:bg-emerald-50">
                          Create Account
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-emerald-100 pt-5 sm:flex-row sm:items-center">
                <button type="button" onClick={goBack} className="order-2 rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 sm:order-1">
                  ← Back
                </button>
                <div className="order-1 flex flex-1 flex-col gap-3 sm:order-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => { setFormData({ ...INITIAL_FORM, doctorId: formData.doctorId, type: formData.type }); setFeedback(null); setActiveStep(1); setVisibleWeekStart(today); }} className="rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                    🔄 Start Over
                  </button>
                  <button type="submit" disabled={isLoading || isSubmitting || !step4Done || !accessToken} className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmitting ? "Processing..." : formData.type === "Online" ? "Proceed to Payment" : "Confirm Appointment"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function HorizontalBookingStepper({
  labels,
  activeStep,
  onStepClick,
}: {
  labels: readonly string[];
  activeStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <nav aria-label="Booking progress" className="w-full">
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="flex min-w-max items-start px-1">
        {labels.map((label, i) => {
          const step = i + 1;
          const isCurrent = step === activeStep;
          const isComplete = step < activeStep;
          return (
            <Fragment key={label}>
              {i > 0 ? <div className={`mt-5 h-[2px] min-w-[6px] flex-1 ${isComplete ? "bg-emerald-400" : "bg-emerald-100"}`} aria-hidden /> : null}
              <div className="flex w-[4.75rem] shrink-0 flex-col items-center sm:w-32">
                <button
                  type="button"
                  onClick={() => onStepClick(step)}
                  title={`Step ${step}: ${label}`}
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${
                    isCurrent ? "bg-[linear-gradient(135deg,#059669,#10b981)] text-white shadow-[0_12px_24px_rgba(16,185,129,0.24)]" : isComplete ? "bg-emerald-500 text-white shadow-sm" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {isComplete ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </button>
                <p className={`mt-3 w-full px-1 text-center text-[10px] font-medium leading-tight sm:text-xs ${isCurrent ? "text-slate-900" : "text-slate-600"}`}>
                  {label}
                </p>
              </div>
            </Fragment>
          );
        })}
        </div>
      </div>
    </nav>
  );
}

function WizardNav({
  showBack,
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  showBack?: boolean;
  onBack?: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  nextLabel: string;
}) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${showBack ? "sm:justify-between" : "sm:justify-end"}`}>
      {showBack ? (
        <button type="button" onClick={onBack} className="w-full rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 sm:w-auto">
          ← Back
        </button>
      ) : null}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="w-full rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
        {nextLabel} →
      </button>
    </div>
  );
}

function SummaryRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className={`font-medium ${done ? "text-slate-600" : "text-slate-400"}`}>{label}</span>
      <span className={`break-words font-semibold sm:max-w-[60%] sm:text-right ${done ? "text-slate-900" : "text-slate-500"}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "slate" | "teal" | "sky" | "amber" }) {
  const colorMap = {
    slate: "border-white/70 bg-white/80",
    teal: "border-emerald-100 bg-white/85",
    sky: "border-teal-100 bg-white/85",
    amber: "border-lime-100 bg-white/85",
  };
  return (
    <div className={`min-w-0 rounded-[1.4rem] border p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(16,185,129,0.12)] ${colorMap[color]}`}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">{value}</p>
    </div>
  );
}
