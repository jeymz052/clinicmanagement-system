"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
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

const INITIAL_FORM: BookingForm = {
  patientName: "",
  email: "",
  phone: "",
  doctorId: "chiara-punzalan",
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

  useEffect(() => {
    if (!doctors.length) return;
    setFormData((current) => {
      if (doctors.some((doctor) => doctor.id === current.doctorId)) return current;
      return { ...current, doctorId: doctors[0]?.id ?? current.doctorId, start: "" };
    });
  }, [doctors]);

  useEffect(() => {
    const weekDates = getWeekDates(visibleWeekStart);
    const lastDate = weekDates[weekDates.length - 1];
    if (formData.date < visibleWeekStart || formData.date > lastDate) {
      setVisibleWeekStart(formData.date);
    }
  }, [formData.date, visibleWeekStart]);

  const BOOKING_STEP_LABELS = [
    "Service & Doctor",
    "Patient Information",
    "Date & Time",
    "Review & Confirm",
  ] as const;

  const weekDates = useMemo(() => getWeekDates(visibleWeekStart), [visibleWeekStart]);
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
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fafc_55%,_#eff6ff)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Appointment Booking</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Book a doctor in one guided flow.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Shared hourly slots stay synchronized across clinic and online consultations, capped at 5 patients.
              Full or conflicting times are disabled automatically, and we guide you to the next open slot.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <HorizontalBookingStepper
            labels={BOOKING_STEP_LABELS}
            activeStep={activeStep}
            onStepClick={goToStep}
          />
        </div>

        <div className="mt-6 space-y-5">
          {activeStep === 1 ? (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Choose visit type</h2>
                    <p className="mt-1 text-xs text-slate-500">Pick how the consultation will happen before choosing your doctor and schedule.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 lg:max-w-xs">
                    Shared-slot policy: once any booking exists for an hour, the other appointment type is blocked for that same doctor and time.
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {(["Clinic", "Online"] as AppointmentType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm("type", type)}
                      className={`rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                        formData.type === type
                          ? type === "Clinic"
                            ? "border-teal-600 bg-teal-50"
                            : "border-sky-600 bg-sky-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2 ${
                          formData.type === type
                            ? type === "Clinic" ? "bg-teal-100" : "bg-sky-100"
                            : "bg-slate-100"
                        }`}>
                          {type === "Clinic" ? (
                            <svg className={`h-5 w-5 ${formData.type === type ? "text-teal-600" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          ) : (
                            <svg className={`h-5 w-5 ${formData.type === type ? "text-sky-600" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className={`font-semibold ${formData.type === type ? "text-slate-900" : "text-slate-700"}`}>
                            {type === "Clinic" ? "Clinic Visit" : "Online Consultation"}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {type === "Clinic" ? "Pay after consultation via POS" : "Payment required first, meeting link released after payment"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Select doctor</label>
                    <select
                      value={formData.doctorId}
                      onChange={(event) => updateForm("doctorId", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-teal-200"
                    >
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name} | {doctor.specialty}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-500">
                      Doctor availability, active schedule, unavailability, existing clinic bookings, and online bookings all affect slot availability.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Selected doctor</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{selectedDoctor?.name ?? "Assigned doctor"}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedDoctor?.specialty ?? "General practice"}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                        <p className="text-slate-500">Clinic fee</p>
                        <p className="mt-1 font-semibold text-slate-900">PHP {fees.clinic.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                        <p className="text-slate-500">Online fee</p>
                        <p className="mt-1 font-semibold text-slate-900">PHP {fees.online.toLocaleString()}</p>
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
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900">Patient information</h2>
                <p className="mt-1 text-xs text-slate-500">We will use these details for your appointment record and follow-up messages.</p>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Full name</label>
                    <input type="text" value={formData.patientName} onChange={(e) => updateForm("patientName", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-200" placeholder="Juan Dela Cruz" autoComplete="name" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                    <input type="email" value={formData.email} onChange={(e) => updateForm("email", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-200" placeholder="juan@email.com" autoComplete="email" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                    <input type="tel" value={formData.phone} onChange={(e) => updateForm("phone", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-200" placeholder="+63 912 345 6789" autoComplete="tel" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Reason for visit</label>
                    <input type="text" value={formData.reason} onChange={(e) => updateForm("reason", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-200" placeholder="Describe symptoms or consultation purpose" />
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Choose date & time</h2>
                        <p className="mt-1 text-xs text-slate-500">Each doctor time slot is one shared resource across clinic and online appointments.</p>
                      </div>
                      {nextAvailableSlot ? (
                        <button
                          type="button"
                          onClick={() => {
                            updateForm("date", nextAvailableSlot.date);
                            updateForm("start", nextAvailableSlot.slot.start);
                          }}
                          className="shrink-0 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100"
                        >
                          Next available: {formatDisplayDate(nextAvailableSlot.date)} {formatRange(nextAvailableSlot.slot.start, nextAvailableSlot.slot.end)}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Calendar booking</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart((current) => {
                              const candidate = addDays(current, -7);
                              return candidate < today ? today : candidate;
                            })}
                            disabled={visibleWeekStart <= today}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart(addDays(visibleWeekStart, 7))}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                          >
                            Next
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                        {weekDates.map((date) => {
                          const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${date}T00:00:00`));
                          const isSelected = formData.date === date;
                          return (
                            <button
                              key={date}
                              type="button"
                              onClick={() => updateForm("date", date)}
                              className={`rounded-2xl border px-3 py-3 text-left transition ${
                                isSelected
                                  ? "border-teal-600 bg-teal-50"
                                  : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50"
                              }`}
                            >
                              <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isSelected ? "text-teal-700" : "text-slate-500"}`}>{dayLabel}</p>
                              <p className={`mt-1 text-sm font-semibold ${isSelected ? "text-teal-800" : "text-slate-900"}`}>{formatDisplayDate(date)}</p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-slate-600">Or pick a specific date</label>
                        <input type="date" value={formData.date} min={today} onChange={(e) => updateForm("date", e.target.value)} className="w-full sm:w-auto rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 outline-none transition focus:ring-2 focus:ring-teal-200" />
                      </div>
                    </div>

                    {blockedReason ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {blockedReason} Please choose another date or use the next available suggestion.
                      </div>
                    ) : null}
                  </div>

                  <SharedSlotPicker
                    slotStatuses={slotStatuses}
                    selectedStart={formData.start}
                    onSelect={(start) => updateForm("start", start)}
                    disabled={isLoading || isSubmitting}
                    loading={availabilityLoading}
                    subtitle={`Viewing live availability for ${selectedDoctor?.name ?? "the selected doctor"} on ${formatDisplayDate(formData.date)}.`}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Booking summary</p>
                  <div className="mt-4 space-y-3">
                    <SummaryRow label="Visit type" value={formData.type === "Clinic" ? "Clinic Visit" : "Online Consultation"} done />
                    <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                    <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={!!formData.date} />
                    <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Choose a slot"} done={!!selectedSlot} />
                    <SummaryRow label="Queue #" value={selectedSlot?.nextQueueNumber ? String(selectedSlot.nextQueueNumber) : "Will appear after slot selection"} done={!!selectedSlot} />
                    <SummaryRow label="Payment" value={formData.type === "Clinic" ? "Pay after consultation" : "Pay now to confirm"} done />
                  </div>

                  <div className={`mt-5 rounded-2xl border px-4 py-3 text-xs ${
                    formData.type === "Clinic"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-sky-200 bg-sky-50 text-sky-800"
                  }`}>
                    {formData.type === "Clinic"
                      ? `Clinic fee: PHP ${fees.clinic.toLocaleString()}. Payment is collected after the consultation through POS.`
                      : `Online fee: PHP ${fees.online.toLocaleString()}. After booking, you will be redirected to payment before the appointment is confirmed.`}
                  </div>
                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step3Valid} nextLabel="Continue to review" />
            </>
          ) : null}

          {activeStep === 4 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Review & confirm</h2>
              <p className="mt-1 text-xs text-slate-500">Check everything below before you secure the slot.</p>

              <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">What happens next</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    <StepCallout number="1" text={formData.type === "Clinic" ? "Your clinic appointment is confirmed immediately." : "Your online appointment is reserved and sent to payment right away."} />
                    <StepCallout number="2" text={formData.type === "Clinic" ? "You pay after consultation using POS at the clinic." : "After successful payment, the system confirms the booking and generates the meeting link."} />
                    <StepCallout number="3" text="The selected doctor and queue number are stored automatically for the chosen shared slot." />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                <button type="button" onClick={goBack} className="order-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:order-1">
                  Back
                </button>
                <div className="order-1 flex flex-1 flex-col gap-3 sm:order-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => { setFormData({ ...INITIAL_FORM, doctorId: formData.doctorId, type: formData.type }); setFeedback(null); setActiveStep(1); setVisibleWeekStart(today); }} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                    Reset
                  </button>
                  <button type="submit" disabled={isLoading || isSubmitting || !step4Done} className="rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300">
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
              {i > 0 ? <div className="mt-4 h-px min-w-[6px] flex-1 bg-slate-200" aria-hidden /> : null}
              <div className="flex w-[4.25rem] shrink-0 flex-col items-center sm:w-28">
                <button
                  type="button"
                  onClick={() => onStepClick(step)}
                  title={`Step ${step}: ${label}`}
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${
                    isCurrent ? "bg-emerald-700 text-white shadow-sm" : isComplete ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
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
                <p className={`mt-2.5 w-full px-0.5 text-center text-[10px] font-medium leading-tight sm:text-xs ${isCurrent ? "text-slate-900" : "text-slate-600"}`}>
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
        <button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          Back
        </button>
      ) : null}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300">
        {nextLabel}
      </button>
    </div>
  );
}

function SummaryRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-medium ${done ? "text-slate-900" : "text-slate-400"}`}>{value}</span>
    </div>
  );
}

function StepCallout({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700">{number}</span>
      <p>{text}</p>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "slate" | "teal" | "sky" | "amber" }) {
  const colorMap = {
    slate: "border-slate-200",
    teal: "border-teal-200 bg-teal-50/50",
    sky: "border-sky-200 bg-sky-50/50",
    amber: "border-amber-200 bg-amber-50/50",
  };
  return (
    <div className={`rounded-xl border bg-white p-4 transition-all duration-200 hover:shadow-md ${colorMap[color]}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
