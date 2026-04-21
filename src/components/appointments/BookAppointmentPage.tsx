  "use client";

import { Fragment, useMemo, useState, useTransition } from "react";
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
  getAppointmentSummary,
  getDoctorById,
  getWeekDates,
  type AppointmentType,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";

type BookingForm = {
  patientName: string;
  email: string;
  phone: string;
  doctorId: string;
  date: string;
  start: string;
  type: AppointmentType;
  reason: string;
};

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
};

export default function BookAppointmentPage() {
  const { accessToken } = useRole();
  const { appointments, setAppointments, isLoading, error } = useAppointments();
  const { doctors } = useDoctors();
  const [formData, setFormData] = useState<BookingForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [visibleWeekStart, setVisibleWeekStart] = useState(today);

  const summary = getAppointmentSummary(appointments);
  const selectedDoctorFromDirectory = doctors.find((doctor) => doctor.id === formData.doctorId) ?? null;
  const selectedDoctor = selectedDoctorFromDirectory
    ?? (formData.doctorId ? getDoctorById(formData.doctorId) : null);
  const { fees } = useDoctorFees(selectedDoctorFromDirectory?.slug ?? formData.doctorId);
  const {
    slotStatuses,
    blockedReason,
    nextAvailableSlot,
    isLoading: availabilityLoading,
    error: availabilityError,
  } = useAppointmentAvailability(formData.doctorId, formData.date, formData.type);
  const selectedSlot = slotStatuses.find((slot) => slot.start === formData.start) ?? null;

  const BOOKING_STEP_LABELS = [
    "Service & Doctor",
    "Patient Information",
    "Date & Time",
    "Review & Confirm",
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

  const step1Valid = !!formData.type;
  const step2Valid =
    !!formData.patientName.trim() && !!formData.email.trim() && !!formData.phone.trim();
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
    else if (activeStep === 3 && step3Valid) goToStep(4);
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

  async function redirectToPayment(appointmentId: string) {
    if (!accessToken) return;

    try {
      const checkoutRes = await fetch("/api/v2/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ appointment_id: appointmentId }),
      });

      if (checkoutRes.ok) {
        const { url } = (await checkoutRes.json()) as { url?: string };
        if (url) {
          window.location.href = url;
          return;
        }
      }
    } catch {
      // Fall through to the local payments page when checkout URL is unavailable.
    }

    window.location.href = `/payments?appointmentId=${appointmentId}`;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeStep !== 4) return;
    if (!accessToken) {
      setFeedback({ message: "Your session expired. Please sign in again.", type: "error" });
      return;
    }

    startSubmitTransition(async () => {
      const result = await createAppointmentAction(accessToken, {
        patientName: formData.patientName,
        email: formData.email,
        phone: formData.phone,
        doctorId: formData.doctorId,
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

      if (formData.type === "Online") {
        setFeedback({
          message: "Online consultation reserved. Redirecting to payment so we can confirm the slot and generate your meeting link.",
          type: "success",
        });
        await redirectToPayment(result.appointment.id);
        return;
      }

      setFormData({ ...INITIAL_FORM, type: formData.type, doctorId: formData.doctorId });
      setVisibleWeekStart(today);
      setActiveStep(1);
      setFeedback({
        message: `Booked! ${result.appointment.patientName} with ${selectedDoctor?.name ?? "doctor"} on ${formatDisplayDate(result.appointment.date)} at ${formatRange(result.appointment.start, result.appointment.end)}. Queue #${result.appointment.queueNumber}.`,
        type: "success",
      });
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),radial-gradient(circle_at_85%_15%,_rgba(34,197,94,0.18),_transparent_20%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-6 shadow-[0_30px_80px_rgba(16,185,129,0.12)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Appointment Booking</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Book your visit in minutes</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              A guided booking flow with live availability, clear queue placement, and a calmer step-by-step experience.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[30rem]">
            <StatCard label="Total" value={summary.total} color="slate" />
            <StatCard label="Clinic" value={summary.clinicCount} color="teal" />
            <StatCard label="Online" value={summary.onlineCount} color="sky" />
            <StatCard label="Pending Payment" value={summary.pendingCount} color="amber" />
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
        <div className="rounded-[2rem] border border-emerald-100 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">
          <HorizontalBookingStepper
            labels={BOOKING_STEP_LABELS}
            activeStep={activeStep}
            onStepClick={goToStep}
          />
        </div>

        <div className="mt-6 space-y-5">
          {activeStep === 1 ? (
            <>
              <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-6 shadow-[0_20px_45px_rgba(16,185,129,0.08)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 1</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Choose visit type</h2>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Booking with {selectedDoctor?.name ?? "assigned doctor"}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(["Clinic", "Online"] as AppointmentType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm("type", type)}
                      className={`group overflow-hidden rounded-[1.75rem] border p-5 text-left transition-all duration-300 ${
                        formData.type === type
                          ? type === "Clinic"
                            ? "border-emerald-500 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] shadow-[0_20px_35px_rgba(16,185,129,0.16)]"
                            : "border-teal-500 bg-[linear-gradient(180deg,#f0fdfa_0%,#ccfbf1_100%)] shadow-[0_20px_35px_rgba(13,148,136,0.14)]"
                          : "border-emerald-100 bg-white hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_18px_32px_rgba(16,185,129,0.10)]"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 transition-transform duration-300 group-hover:scale-105 ${
                          formData.type === type
                            ? type === "Clinic" ? "bg-white/80" : "bg-white/75"
                            : "bg-emerald-50"
                        }`}>
                          {type === "Clinic" ? (
                            <svg className={`h-6 w-6 ${formData.type === type ? "text-emerald-700" : "text-emerald-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          ) : (
                            <svg className={`h-6 w-6 ${formData.type === type ? "text-teal-700" : "text-teal-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className={`text-base font-semibold ${formData.type === type ? "text-slate-900" : "text-slate-700"}`}>
                              {type === "Clinic" ? "Clinic Visit" : "Online Consultation"}
                            </p>
                            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                              formData.type === type
                                ? type === "Clinic"
                                  ? "bg-white/80 text-emerald-700"
                                  : "bg-white/80 text-teal-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}>
                              {formData.type === type ? "Selected" : "Choose"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {type === "Clinic" ? "Clinic Visit" : "Online Consultation"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Assigned doctor</label>
                    <div className="mt-3 rounded-[1.4rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)] px-4 py-4">
                      <p className="text-base font-semibold text-slate-900">
                        Dra. Chiara C. Punzalan M.D.
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        General Medicine
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#dcfce7_100%)] p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Consultation fees</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">{selectedDoctor?.name ?? "Assigned doctor"}</p>
                    <p className="mt-1 text-sm text-slate-600">{selectedDoctor?.specialty ?? "General practice"}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-[1.2rem] border border-white/70 bg-white/80 px-3 py-3 shadow-sm">
                        <p className="text-slate-500">Clinic fee</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">PHP {fees.clinic.toLocaleString()}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/70 bg-white/80 px-3 py-3 shadow-sm">
                        <p className="text-slate-500">Online fee</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">PHP {fees.online.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <WizardNav showBack={false} onNext={goNext} nextDisabled={!step1Valid} nextLabel="Continue" />
            </>
          ) : null}

          {activeStep === 2 ? (
            <>
              <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-6 shadow-[0_20px_45px_rgba(16,185,129,0.08)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 2</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Patient information</h2>
                  </div>
                  <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 sm:block">
                    Required before scheduling
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Full name</label>
                    <input type="text" value={formData.patientName} onChange={(e) => updateForm("patientName", e.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="Juan Dela Cruz" autoComplete="name" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Email</label>
                    <input type="email" value={formData.email} onChange={(e) => updateForm("email", e.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="juan@email.com" autoComplete="email" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Phone</label>
                    <input type="tel" value={formData.phone} onChange={(e) => updateForm("phone", e.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="+63 912 345 6789" autoComplete="tel" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Reason for visit</label>
                    <input type="text" value={formData.reason} onChange={(e) => updateForm("reason", e.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="Describe symptoms or consultation purpose" />
                  </div>
                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step2Valid} nextLabel="Continue" />
            </>
          ) : null}

          {activeStep === 3 ? (
            <>
              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-5">
                  <div className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-6 shadow-[0_20px_45px_rgba(16,185,129,0.08)]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 3</p>
                        <h2 className="mt-2 text-xl font-bold text-slate-900">Choose date & time</h2>
                      </div>
                      {nextAvailableSlot ? (
                        <button
                          type="button"
                          onClick={() => {
                            updateForm("date", nextAvailableSlot.date);
                            updateForm("start", nextAvailableSlot.slot.start);
                          }}
                          className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Next available: {formatDisplayDate(nextAvailableSlot.date)} {formatRange(nextAvailableSlot.slot.start, nextAvailableSlot.slot.end)}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-5 rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(180deg,#fafffb_0%,#eefcf2_100%)] p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Calendar booking</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart((current) => {
                              const candidate = addDays(current, -7);
                              return candidate < today ? today : candidate;
                            })}
                            disabled={calendarWeekStart <= today}
                            className="rounded-full border border-emerald-100 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart(addDays(calendarWeekStart, 7))}
                            className="rounded-full border border-emerald-100 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                          >
                            Next
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                        {weekDates.map((date) => {
                          const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${date}T00:00:00`));
                          const isSelected = formData.date === date;
                          return (
                            <button
                              key={date}
                              type="button"
                              onClick={() => updateForm("date", date)}
                              className={`rounded-[1.35rem] border px-3 py-3 text-left transition-all duration-200 ${
                                isSelected
                                  ? "border-emerald-500 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] shadow-[0_12px_24px_rgba(16,185,129,0.12)]"
                                  : "border-emerald-100 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/50"
                              }`}
                            >
                              <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isSelected ? "text-emerald-700" : "text-slate-500"}`}>{dayLabel}</p>
                              <p className={`mt-2 text-sm font-semibold ${isSelected ? "text-emerald-800" : "text-slate-900"}`}>{formatDisplayDate(date)}</p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3">
                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Pick a specific date</label>
                        <input type="date" value={formData.date} min={today} onChange={(e) => updateForm("date", e.target.value)} className="w-full sm:w-auto rounded-[1.1rem] border border-emerald-100 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" />
                      </div>
                    </div>

                    {blockedReason ? (
                      <div className="mt-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
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

                <div className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-5 shadow-[0_18px_40px_rgba(16,185,129,0.08)] xl:sticky xl:top-24">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Booking summary</p>
                  <div className="mt-4 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
                    <div className="space-y-3">
                      <SummaryRow label="Visit type" value={formData.type === "Clinic" ? "Clinic Visit" : "Online Consultation"} done />
                      <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                      <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={!!formData.date} />
                      <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Choose a slot"} done={!!selectedSlot} />
                      <SummaryRow label="Queue #" value={selectedSlot?.nextQueueNumber ? String(selectedSlot.nextQueueNumber) : "Will appear after slot selection"} done={!!selectedSlot} />
                      <SummaryRow label="Payment" value={formData.type === "Clinic" ? "Pay after consultation" : "Pay now to confirm"} done />
                    </div>
                  </div>
                  <div className="mt-4 rounded-[1.4rem] border border-emerald-100 bg-white px-4 py-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Estimated fee</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      PHP {(formData.type === "Online" ? fees.online : fees.clinic).toLocaleString()}
                    </p>
                  </div>
                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step3Valid} nextLabel="Continue to review" />
            </>
          ) : null}

          {activeStep === 4 ? (
            <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f6fef9_100%)] p-6 shadow-[0_22px_48px_rgba(16,185,129,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 4</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Review & confirm</h2>

              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
                <div className="space-y-3 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm">
                  <SummaryRow label="Visit type" value={formData.type === "Clinic" ? "Clinic Visit" : "Online Consultation"} done />
                  <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                  <SummaryRow label="Patient" value={formData.patientName} done={step2Valid} />
                  <SummaryRow label="Contact" value={[formData.email, formData.phone].filter(Boolean).join(" | ") || "-"} done={step2Valid} />
                  {formData.reason ? <SummaryRow label="Reason" value={formData.reason} done /> : null}
                  <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={datePicked} />
                  <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "-"} done={step3Valid} />
                  {selectedSlot ? <SummaryRow label="Queue #" value={String(selectedSlot.nextQueueNumber)} done /> : null}
                  <SummaryRow label={formData.type === "Online" ? "Fee (pay now)" : "Fee (pay after)"} value={`PHP ${(formData.type === "Online" ? fees.online : fees.clinic).toLocaleString()}`} done />
                </div>
                <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ready to book</p>
                  <p className="mt-3 text-3xl font-black text-slate-900">
                    Queue {selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "--"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Select a time slot first"}
                  </p>
                  <div className="mt-5 rounded-[1.4rem] border border-emerald-100 bg-emerald-50 px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Payment amount</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      PHP {(formData.type === "Online" ? fees.online : fees.clinic).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                <button type="button" onClick={goBack} className="order-2 rounded-full border border-emerald-100 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 sm:order-1">
                  Back
                </button>
                <div className="order-1 flex flex-1 flex-col gap-3 sm:order-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => { setFormData({ ...INITIAL_FORM, doctorId: formData.doctorId, type: formData.type }); setFeedback(null); setActiveStep(1); setVisibleWeekStart(today); }} className="rounded-full border border-emerald-100 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                    Reset
                  </button>
                  <button type="submit" disabled={isLoading || isSubmitting || !step4Done} className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmitting ? "Booking..." : formData.type === "Online" ? "Reserve Slot & Pay Now" : "Confirm Booking"}
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
      <div className="flex w-full items-start">
        {labels.map((label, i) => {
          const step = i + 1;
          const isCurrent = step === activeStep;
          const isComplete = step < activeStep;
          return (
            <Fragment key={label}>
              {i > 0 ? <div className={`mt-5 h-[2px] min-w-[6px] flex-1 ${isComplete ? "bg-emerald-400" : "bg-emerald-100"}`} aria-hidden /> : null}
              <div className="flex w-[4.5rem] shrink-0 flex-col items-center sm:w-32">
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
    <div className={`flex items-center gap-3 ${showBack ? "justify-between" : "justify-end"}`}>
      {showBack ? (
        <button type="button" onClick={onBack} className="rounded-full border border-emerald-100 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
          Back
        </button>
      ) : null}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60">
        {nextLabel}
      </button>
    </div>
  );
}

function SummaryRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1rem] px-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-medium ${done ? "text-slate-900" : "text-slate-400"}`}>{value}</span>
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
    <div className={`rounded-[1.4rem] border p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(16,185,129,0.12)] ${colorMap[color]}`}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}
