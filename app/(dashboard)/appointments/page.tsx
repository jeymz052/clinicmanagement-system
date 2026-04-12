"use client";

import { useState, useTransition } from "react";
import { createAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctorUnavailability } from "@/src/components/clinic/useClinicData";
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

const INITIAL_FORM: BookingForm = {
  patientName: "",
  email: "",
  phone: "",
  doctorId: "lina-fox",
  date: "2026-04-13",
  start: "",
  type: "Clinic",
  reason: "",
};

export default function BookAppointmentPage() {
  const { accessToken } = useRole();
  const { appointments, setAppointments, isLoading, error } = useAppointments();
  const { data: unavailability } = useDoctorUnavailability();
  const [formData, setFormData] = useState<BookingForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();

  const summary = getAppointmentSummary(appointments);
  const selectedDoctor = getDoctorById(formData.doctorId);
  const blockedDays = buildBlockedDayLookup(unavailability, formData.doctorId);
  const slotStatuses = getSlotStatuses(
    formData.doctorId,
    formData.date,
    formData.type,
    appointments,
    blockedDays,
  );
  const selectedSlot = slotStatuses.find((slot) => slot.start === formData.start) ?? null;
  const nextAvailableSlot = findNextAvailableSlot(
    formData.doctorId,
    formData.date,
    formData.type,
    appointments,
    blockedDays,
  );
  const blockedReason = blockedDays[formData.date]?.reason ?? null;

  function getBlockedLookupForDoctor(doctorId: string) {
    return buildBlockedDayLookup(unavailability, doctorId);
  }

  function updateForm<K extends keyof BookingForm>(field: K, value: BookingForm[K]) {
    setFormData((current) => {
      const nextState = { ...current, [field]: value };

      if (field === "doctorId" || field === "date" || field === "type") {
        const nextDoctorId =
          field === "doctorId" ? (value as string) : nextState.doctorId;
        const nextDate = field === "date" ? (value as string) : nextState.date;
        const nextType =
          field === "type" ? (value as AppointmentType) : nextState.type;
        const nextSlots = getSlotStatuses(
          nextDoctorId,
          nextDate,
          nextType,
          appointments,
          getBlockedLookupForDoctor(nextDoctorId),
        );
        const currentSelection = nextSlots.find((slot) => slot.start === nextState.start);

        if (!currentSelection?.availableForType) {
          nextState.start = "";
        }
      }

      return nextState;
    });
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
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
        setFeedback(result.message);
        return;
      }

      setFormData((current) => ({
        ...current,
        patientName: "",
        email: "",
        phone: "",
        start: "",
        reason: "",
      }));
      setFeedback(
        `${result.appointment.patientName} booked with ${
          selectedDoctor?.name ?? "the selected doctor"
        } on ${formatDisplayDate(result.appointment.date)} at ${formatRange(
          result.appointment.start,
          result.appointment.end,
        )}. Queue number ${result.appointment.queueNumber}.`,
      );
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Appointment Module</h1>
          <p className="mt-1 text-sm text-slate-500">
            Shared slot booking for clinic and online consultations with automatic queue control.
          </p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Max 5 patients per doctor per hour. Mixed clinic and online bookings are blocked in the
          same slot.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <MetricCard
          label="Total Appointments"
          value={summary.total.toString()}
          note="Saved in the persistent schedule store"
        />
        <MetricCard
          label="Clinic Appointments"
          value={summary.clinicCount.toString()}
          note="Pay after consultation via POS"
        />
        <MetricCard
          label="Online Consultations"
          value={summary.onlineCount.toString()}
          note="Payment first, then meeting link is generated"
        />
        <MetricCard
          label="Pending Payment"
          value={summary.pendingCount.toString()}
          note="Online consults awaiting payment"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr,0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Patient Name">
                <input
                  type="text"
                  value={formData.patientName}
                  onChange={(event) => updateForm("patientName", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 transition focus:ring"
                  placeholder="John Doe"
                  required
                />
              </Field>
              <Field label="Doctor">
                <select
                  value={formData.doctorId}
                  onChange={(event) => updateForm("doctorId", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-teal-200 transition focus:ring"
                >
                  {DOCTORS.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialty}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 transition focus:ring"
                  placeholder="john@example.com"
                  required
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 transition focus:ring"
                  placeholder="+1 (555) 000-0000"
                  required
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={formData.date}
                  onChange={(event) => updateForm("date", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 transition focus:ring"
                  required
                />
              </Field>
              <Field label="Appointment Type">
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["Clinic", "Online"] as AppointmentType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm("type", type)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                        formData.type === type
                          ? "border-teal-700 bg-teal-700 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="Reason for Visit">
              <textarea
                value={formData.reason}
                onChange={(event) => updateForm("reason", event.target.value)}
                className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 transition focus:ring"
                placeholder="Describe the symptoms or consultation purpose"
              />
            </Field>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Available Time Slots</h2>
                  <p className="text-sm text-slate-500">
                    Slots are disabled when the doctor is unavailable, full, or occupied by the
                    other appointment type.
                  </p>
                </div>
                {nextAvailableSlot ? (
                  <button
                    type="button"
                    onClick={() => {
                      updateForm("date", nextAvailableSlot.date);
                      updateForm("start", nextAvailableSlot.slot.start);
                    }}
                    className="rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
                  >
                    Suggest next available: {formatDisplayDate(nextAvailableSlot.date)}{" "}
                    {formatRange(nextAvailableSlot.slot.start, nextAvailableSlot.slot.end)}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {slotStatuses.map((slot) => {
                  const isSelected = formData.start === slot.start;

                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={!slot.availableForType || isLoading || isSubmitting}
                      onClick={() => updateForm("start", slot.start)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-teal-700 bg-teal-700 text-white"
                          : slot.availableForType
                            ? "border-slate-200 bg-white text-slate-900 hover:border-teal-300 hover:bg-teal-50"
                            : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{formatRange(slot.start, slot.end)}</p>
                          <p className={`text-xs ${isSelected ? "text-teal-100" : "text-slate-500"}`}>
                            Schedule type: {slot.mode}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            isSelected
                              ? "bg-white/15 text-white"
                              : slot.availableForType
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {slot.bookedCount}/5
                        </span>
                      </div>
                      <p className={`mt-3 text-xs ${isSelected ? "text-teal-100" : "text-slate-500"}`}>
                        {slot.availableForType
                          ? `Queue number ${slot.nextQueueNumber} will be assigned automatically.`
                          : slot.reason}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {blockedReason ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {selectedDoctor?.name} is marked as {blockedReason.toLowerCase()} on{" "}
                {formatDisplayDate(formData.date)}. That entire day is unavailable for booking.
              </div>
            ) : null}

            {selectedSlot ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {selectedDoctor?.name} on {formatDisplayDate(formData.date)} at{" "}
                {formatRange(selectedSlot.start, selectedSlot.end)} is reserved for{" "}
                {formData.type.toLowerCase()} appointments. Queue number preview:{" "}
                {selectedSlot.nextQueueNumber}.
              </div>
            ) : null}

            {formData.type === "Clinic" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Clinic appointments do not require advance payment. Patients can pay after the
                consultation through the POS module.
              </div>
            ) : (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Online consultations require payment first. Once payment is confirmed, the system
                generates the meeting link automatically for that appointment.
              </div>
            )}

            {feedback ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {feedback}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading || isSubmitting || !formData.start}
                className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {isSubmitting ? "Saving Appointment..." : "Reserve Slot"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData(INITIAL_FORM);
                  setFeedback(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset Form
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Validation Checklist</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <ChecklistItem label="Doctor availability" />
              <ChecklistItem label="Schedule type compatibility" />
              <ChecklistItem label="Max patient limit (5 per hour)" />
              <ChecklistItem label="Existing shared-slot bookings" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Current Doctor Snapshot</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedDoctor?.name} - {selectedDoctor?.specialty}
            </p>
            <div className="mt-4 space-y-3">
              {slotStatuses.map((slot) => (
                <div key={slot.start} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">
                      {formatRange(slot.start, slot.end)}
                    </p>
                    <span className="text-xs font-semibold text-slate-500">
                      Queue {slot.queueNumbers.length ? slot.queueNumbers.join(", ") : "Open"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {slot.activeType
                      ? `${slot.activeType} slot in use with ${slot.bookedCount} patient(s).`
                      : "No active bookings yet."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md transition-all duration-200 hover:bg-teal-50 hover:border-teal-300 hover:scale-[1.04] animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function ChecklistItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
        ✓
      </span>
      <p>{label}</p>
    </div>
  );
}
