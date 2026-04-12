"use client";

import { useState, useTransition } from "react";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctorUnavailability } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  buildBlockedDayLookup,
  DOCTORS,
  formatDisplayDate,
  formatRange,
  getSlotStatuses,
  type AppointmentType,
} from "@/src/lib/appointments";
import type { AvailabilityReason } from "@/src/lib/clinic";

type BlockForm = {
  doctorId: string;
  date: string;
  reason: AvailabilityReason;
  note: string;
};

const INITIAL_FORM: BlockForm = {
  doctorId: "lina-fox",
  date: "2026-04-15",
  reason: "Not Available",
  note: "",
};

export default function TimeSlotsPage() {
  const { accessToken, role } = useRole();
  const { appointments } = useAppointments();
  const { data: blockedDates, setData: setBlockedDates, isLoading, error } = useDoctorUnavailability();
  const [form, setForm] = useState<BlockForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [viewType, setViewType] = useState<AppointmentType>("Clinic");
  const [isSaving, startTransition] = useTransition();

  const doctor = DOCTORS.find((item) => item.id === form.doctorId) ?? DOCTORS[0];
  const blockedLookup = buildBlockedDayLookup(blockedDates, doctor.id);
  const statuses = getSlotStatuses(doctor.id, form.date, viewType, appointments, blockedLookup);
  const doctorBlocks = blockedDates
    .filter((item) => item.doctorId === doctor.id)
    .sort((left, right) => left.date.localeCompare(right.date));
  const canManage = role !== "PATIENT";

  function updateField<K extends keyof BlockForm>(field: K, value: BlockForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function saveBlockedDay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/unavailability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        setFeedback("Unable to save unavailable date.");
        return;
      }

      const payload = (await response.json()) as { data: typeof blockedDates };
      setBlockedDates(payload.data);
      setFeedback(`Saved ${form.reason.toLowerCase()} for ${doctor.name} on ${formatDisplayDate(form.date)}.`);
      setForm((current) => ({ ...current, note: "" }));
    });
  }

  function removeBlockedDay(id: string) {
    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/unavailability?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        setFeedback("Unable to remove unavailable date.");
        return;
      }

      const payload = (await response.json()) as { data: typeof blockedDates };
      setBlockedDates(payload.data);
      setFeedback("Unavailable date removed.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Unavailable Dates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Doctors can mark full days as not available or on leave. Bookings are blocked at both
            the UI and server layer.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Live schedule preview: {doctor.name} on {formatDisplayDate(form.date)}
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Set Doctor Leave / Not Available</h2>
          <form className="mt-5 space-y-4" onSubmit={saveBlockedDay}>
            <Field label="Doctor">
              <select
                value={form.doctorId}
                onChange={(event) => updateField("doctorId", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none ring-teal-200 focus:ring"
              >
                {DOCTORS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Date">
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none ring-teal-200 focus:ring"
                />
              </Field>
              <Field label="Reason">
                <select
                  value={form.reason}
                  onChange={(event) => updateField("reason", event.target.value as AvailabilityReason)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none ring-teal-200 focus:ring"
                >
                  <option value="Not Available">Not Available</option>
                  <option value="Leave">Leave</option>
                </select>
              </Field>
            </div>

            <Field label="Note">
              <textarea
                value={form.note}
                onChange={(event) => updateField("note", event.target.value)}
                className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none ring-teal-200 focus:ring"
                placeholder="Optional note for the team"
              />
            </Field>

            <button
              type="submit"
              disabled={!canManage || isSaving}
              className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {isSaving ? "Saving..." : "Add Unavailable Date"}
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Operational Slot Status</h2>
              <p className="mt-1 text-sm text-slate-500">
                Shared-slot conflict control still applies on available days.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["Clinic", "Online"] as AppointmentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setViewType(type)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    viewType === type
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {statuses.map((slot) => (
              <div key={slot.start} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{formatRange(slot.start, slot.end)}</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {slot.bookedCount}/5
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {slot.availableForType
                    ? `Available for ${viewType.toLowerCase()} queue ${slot.nextQueueNumber}.`
                    : slot.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Saved Unavailable Dates</h2>
        <div className="mt-5 space-y-3">
          {doctorBlocks.length ? (
            doctorBlocks.map((record) => (
              <div
                key={record.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {formatDisplayDate(record.date)} - {record.reason}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{record.note || "No note provided."}</p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => removeBlockedDay(record.id)}
                    className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No unavailable dates saved for this doctor yet.
            </div>
          )}
        </div>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading doctor availability...</p> : null}
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
