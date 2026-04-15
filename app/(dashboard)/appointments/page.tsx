"use client";

import { useState, useTransition } from "react";
import { createAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctorUnavailability } from "@/src/components/clinic/useClinicData";
import { useDoctorFees } from "@/src/components/clinic/useDoctorFees";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  buildBlockedDayLookup,
  DOCTORS,
  findNextAvailableSlot,
  formatDisplayDate,
  formatRange,
  getAppointmentSummary,
  getDoctorById,
  getSlotStatuses,
  type AppointmentType,
} from "@/src/lib/appointments";

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

const today = new Date().toISOString().slice(0, 10);

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
  const { data: unavailability } = useDoctorUnavailability();
  const { fees } = useDoctorFees();
  const [formData, setFormData] = useState<BookingForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();

  const summary = getAppointmentSummary(appointments);
  const selectedDoctor = formData.doctorId ? getDoctorById(formData.doctorId) : null;
  const blockedDays = buildBlockedDayLookup(unavailability, formData.doctorId);
  const slotStatuses = formData.doctorId && formData.date
    ? getSlotStatuses(formData.doctorId, formData.date, formData.type, appointments, blockedDays)
    : [];
  const selectedSlot = slotStatuses.find((s) => s.start === formData.start) ?? null;
  const nextAvailableSlot = formData.doctorId
    ? findNextAvailableSlot(formData.doctorId, formData.date, formData.type, appointments, blockedDays)
    : null;
  const blockedReason = blockedDays[formData.date]?.reason ?? null;
  const availableSlots = slotStatuses.filter((s) => s.availableForType);
  const fullSlots = slotStatuses.filter((s) => !s.availableForType);

  // Step tracking (doctor auto-selected — only one doctor)
  const step1Done = !!formData.type;
  const step2Done = step1Done && !!formData.date && !blockedReason;
  const step3Done = step2Done && !!formData.start;
  const step4Done = step3Done && !!formData.patientName && !!formData.email && !!formData.phone;

  function getBlockedLookupForDoctor(doctorId: string) {
    return buildBlockedDayLookup(unavailability, doctorId);
  }

  function updateForm<K extends keyof BookingForm>(field: K, value: BookingForm[K]) {
    setFormData((current) => {
      const nextState = { ...current, [field]: value };
      if (field === "doctorId" || field === "date" || field === "type") {
        const nextDoctorId = field === "doctorId" ? (value as string) : nextState.doctorId;
        const nextDate = field === "date" ? (value as string) : nextState.date;
        const nextType = field === "type" ? (value as AppointmentType) : nextState.type;
        if (nextDoctorId) {
          const nextSlots = getSlotStatuses(nextDoctorId, nextDate, nextType, appointments, getBlockedLookupForDoctor(nextDoctorId));
          const currentSelection = nextSlots.find((s) => s.start === nextState.start);
          if (!currentSelection?.availableForType) nextState.start = "";
        }
      }
      return nextState;
    });
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      setFormData({ ...INITIAL_FORM, type: formData.type });
      setFeedback({
        message: `Booked! ${result.appointment.patientName} with ${selectedDoctor?.name ?? "doctor"} on ${formatDisplayDate(result.appointment.date)} at ${formatRange(result.appointment.start, result.appointment.end)}. Queue #${result.appointment.queueNumber}.`,
        type: "success",
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Book Appointment</h1>
        <p className="text-sm text-slate-500 mt-0.5">Schedule a clinic visit or online consultation.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total" value={summary.total} color="slate" />
        <StatCard label="Clinic" value={summary.clinicCount} color="teal" />
        <StatCard label="Online" value={summary.onlineCount} color="sky" />
        <StatCard label="Pending Payment" value={summary.pendingCount} color="amber" />
      </div>

      {/* Feedback */}
      {feedback ? (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          feedback.type === "success"
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border border-red-200 bg-red-50 text-red-800"
        }`}>
          {feedback.message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left Column — Booking Steps */}
          <div className="xl:col-span-2 space-y-5">

            {/* Step 1: Appointment Type */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <StepHeader number={1} title="Appointment Type" done={step1Done} />
              <div className="grid grid-cols-2 gap-3 mt-4">
                {(["Clinic", "Online"] as AppointmentType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateForm("type", type)}
                    className={`rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                      formData.type === type
                        ? type === "Clinic"
                          ? "border-teal-600 bg-teal-50"
                          : "border-sky-600 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${
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
                        <p className="text-xs text-slate-500 mt-0.5">
                          {type === "Clinic" ? "Pay after consultation via POS" : "Payment required before consultation"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Doctor info banner */}
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold shrink-0">P</div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedDoctor?.name}</p>
                <p className="text-xs text-slate-500">{selectedDoctor?.specialty}</p>
              </div>
            </div>

            {/* Step 2: Select Date */}
            {step1Done ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <StepHeader number={2} title="Select Date" done={step2Done} />
                <div className="mt-4">
                  <input
                    type="date"
                    value={formData.date}
                    min={today}
                    onChange={(e) => updateForm("date", e.target.value)}
                    className="w-full sm:w-auto rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 outline-none ring-teal-200 transition focus:ring-2"
                    required
                  />
                  {blockedReason ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                      {selectedDoctor?.name} is on <span className="font-semibold">{blockedReason.toLowerCase()}</span> on {formatDisplayDate(formData.date)}. Please select another date.
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* Step 3: Select Time Slot */}
            {step2Done ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <StepHeader number={3} title="Select Time Slot" done={step3Done} />
                  {nextAvailableSlot ? (
                    <button
                      type="button"
                      onClick={() => {
                        updateForm("date", nextAvailableSlot.date);
                        setTimeout(() => updateForm("start", nextAvailableSlot.slot.start), 0);
                      }}
                      className="text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-100 transition"
                    >
                      Next available: {formatDisplayDate(nextAvailableSlot.date)} {formatRange(nextAvailableSlot.slot.start, nextAvailableSlot.slot.end)}
                    </button>
                  ) : null}
                </div>

                <div className="mt-1 mb-3">
                  <p className="text-xs text-slate-500">
                    {availableSlots.length} slot{availableSlots.length !== 1 ? "s" : ""} available
                    {fullSlots.length > 0 ? ` · ${fullSlots.length} full or blocked` : ""}
                    {" · Max 5 patients per slot · Clinic & Online share the same slots"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {slotStatuses.map((slot) => {
                    const isSelected = formData.start === slot.start;
                    const available = slot.availableForType;
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        disabled={!available || isLoading || isSubmitting}
                        onClick={() => updateForm("start", slot.start)}
                        className={`rounded-xl border-2 px-3 py-3 text-left transition-all duration-200 ${
                          isSelected
                            ? "border-teal-600 bg-teal-50 shadow-sm"
                            : available
                              ? "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50"
                              : "border-slate-100 bg-slate-50 cursor-not-allowed opacity-50"
                        }`}
                      >
                        <p className={`text-sm font-semibold ${isSelected ? "text-teal-700" : available ? "text-slate-900" : "text-slate-400"}`}>
                          {formatRange(slot.start, slot.end)}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={`text-[11px] ${isSelected ? "text-teal-600" : "text-slate-400"}`}>
                            {slot.mode}
                          </span>
                          <div className="flex items-center gap-1">
                            {/* Capacity dots */}
                            {[1, 2, 3, 4, 5].map((n) => (
                              <div
                                key={n}
                                className={`h-1.5 w-1.5 rounded-full ${
                                  n <= slot.bookedCount
                                    ? slot.bookedCount >= 5 ? "bg-red-400" : "bg-teal-500"
                                    : "bg-slate-200"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {!available ? (
                          <p className="text-[10px] text-red-400 mt-1 truncate">{slot.reason}</p>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-1">Queue #{slot.nextQueueNumber}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Step 4: Patient Details */}
            {step3Done ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <StepHeader number={4} title="Patient Details" done={step4Done} />
                <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={formData.patientName}
                      onChange={(e) => updateForm("patientName", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-200"
                      placeholder="Juan Dela Cruz"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-200"
                      placeholder="juan@email.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateForm("phone", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-200"
                      placeholder="+63 912 345 6789"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Reason for Visit</label>
                    <input
                      type="text"
                      value={formData.reason}
                      onChange={(e) => updateForm("reason", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-200"
                      placeholder="Describe symptoms or consultation purpose"
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isLoading || isSubmitting || !formData.patientName || !formData.email || !formData.phone}
                    className="rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition disabled:cursor-not-allowed disabled:bg-teal-300"
                  >
                    {isSubmitting ? "Booking..." : formData.type === "Online" ? "Book & Proceed to Payment" : "Confirm Booking"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormData(INITIAL_FORM); setFeedback(null); }}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Reset
                  </button>
                </div>
              </section>
            ) : null}
          </div>

          {/* Right Column — Summary Panel */}
          <div className="space-y-5">
            {/* Booking Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sticky top-4">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Booking Summary</h3>

              <div className="space-y-3">
                <SummaryRow label="Type" value={formData.type === "Clinic" ? "Clinic Visit" : "Online Consultation"} done={step1Done} />
                <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "—"} done />
                <SummaryRow label="Date" value={formData.date ? formatDisplayDate(formData.date) : "Not selected"} done={step2Done} />
                <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Not selected"} done={step3Done} />
                {selectedSlot ? (
                  <SummaryRow label="Queue #" value={String(selectedSlot.nextQueueNumber)} done />
                ) : null}
                <SummaryRow label="Patient" value={formData.patientName || "Not entered"} done={!!formData.patientName} />
                <SummaryRow
                  label={formData.type === "Online" ? "Fee (payable now)" : "Fee (pay after via POS)"}
                  value={`₱${(formData.type === "Online" ? fees.online : fees.clinic).toLocaleString()}`}
                  done
                />
              </div>

              {/* Payment note */}
              <div className={`mt-4 rounded-xl px-3 py-2.5 text-xs ${
                formData.type === "Clinic"
                  ? "bg-amber-50 border border-amber-200 text-amber-800"
                  : "bg-sky-50 border border-sky-200 text-sky-800"
              }`}>
                {formData.type === "Clinic"
                  ? `No advance payment needed. ₱${fees.clinic.toLocaleString()} payable after consultation via POS.`
                  : `Online consultation requires ₱${fees.online.toLocaleString()} payment first. Meeting link will be generated after payment.`}
              </div>
            </div>

            {/* Slot Legend */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Slot Rules</h3>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1,2,3].map(n => <div key={n} className="h-1.5 w-1.5 rounded-full bg-teal-500" />)}
                    {[4,5].map(n => <div key={n} className="h-1.5 w-1.5 rounded-full bg-slate-200" />)}
                  </div>
                  <span>3 of 5 slots filled</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => <div key={n} className="h-1.5 w-1.5 rounded-full bg-red-400" />)}
                  </div>
                  <span>Slot full (5/5)</span>
                </div>
                <p className="pt-1 text-slate-500">Clinic and Online share the same time slots. If one type is booked, the other is blocked for that slot.</p>
              </div>
            </div>

            {/* Validation */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Validation</h3>
              <div className="space-y-2">
                <CheckItem label="Doctor availability" checked={!blockedReason && !!formData.date} />
                <CheckItem label="Schedule type compatibility" checked={step2Done} />
                <CheckItem label="Max 5 patients per hour" checked={step3Done} />
                <CheckItem label="No slot conflicts" checked={step3Done} />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ── Sub-components ── */

function StepHeader({ number, title, done }: { number: number; title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
        done ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"
      }`}>
        {done ? (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : number}
      </div>
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
    </div>
  );
}

function SummaryRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${done ? "text-slate-900" : "text-slate-400"}`}>{value}</span>
    </div>
  );
}

function CheckItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`h-4 w-4 rounded-full flex items-center justify-center ${checked ? "bg-emerald-100" : "bg-slate-100"}`}>
        {checked ? (
          <svg className="h-2.5 w-2.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        )}
      </div>
      <span className={checked ? "text-slate-700" : "text-slate-400"}>{label}</span>
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
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
