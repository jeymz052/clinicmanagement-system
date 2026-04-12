"use client";

import { useState } from "react";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctorUnavailability } from "@/src/components/clinic/useClinicData";
import {
  buildBlockedDayLookup,
  DOCTORS,
  formatDisplayDate,
  formatRange,
  getSlotStatuses,
} from "@/src/lib/appointments";

export default function SchedulesPage() {
  const [doctorId, setDoctorId] = useState(DOCTORS[0]?.id ?? "");
  const [date, setDate] = useState("2026-04-13");
  const { appointments, isLoading, error } = useAppointments();
  const { data: blockedDates } = useDoctorUnavailability();

  const doctor = DOCTORS.find((item) => item.id === doctorId) ?? DOCTORS[0];
  const blockedLookup = buildBlockedDayLookup(blockedDates, doctor.id);
  const clinicStatuses = getSlotStatuses(doctor.id, date, "Clinic", appointments, blockedLookup);
  const onlineStatuses = getSlotStatuses(doctor.id, date, "Online", appointments, blockedLookup);
  const upcomingBlocks = blockedDates
    .filter((item) => item.doctorId === doctor.id)
    .sort((left, right) => left.date.localeCompare(right.date));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Doctor Schedules</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track shared slot usage, doctor availability, and conflict control by day.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Select Doctor
            <select
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none ring-teal-200 focus:ring"
            >
              {DOCTORS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.specialty}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Select Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none ring-teal-200 focus:ring"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Upcoming Leave / Not Available</h2>
          <div className="mt-5 space-y-3">
            {upcomingBlocks.length ? (
              upcomingBlocks.map((record) => (
                <div key={record.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <p className="font-semibold text-slate-900">
                    {formatDisplayDate(record.date)} - {record.reason}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{record.note || "No note provided."}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No leave blocks set for this doctor yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Daily Shared Resource Summary</h2>
          <p className="mt-1 text-sm text-slate-500">
            Each hourly slot is treated as one shared resource regardless of appointment type.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <ScheduleColumn title="Clinic View" slots={clinicStatuses} />
            <ScheduleColumn title="Online View" slots={onlineStatuses} />
          </div>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading persisted schedule...</p> : null}
    </div>
  );
}

function ScheduleColumn({
  title,
  slots,
}: {
  title: string;
  slots: ReturnType<typeof getSlotStatuses>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      <div className="mt-3 space-y-3">
        {slots.map((slot) => (
          <div key={slot.start} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{formatRange(slot.start, slot.end)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Schedule: {slot.mode} | Occupancy: {slot.bookedCount}/5
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  slot.availableForType
                    ? "bg-emerald-100 text-emerald-700"
                    : slot.isFull
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-200 text-slate-700"
                }`}
              >
                {slot.availableForType ? `Queue ${slot.nextQueueNumber} next` : slot.reason}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
