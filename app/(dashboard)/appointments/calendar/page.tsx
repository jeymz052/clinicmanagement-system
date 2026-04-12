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
  getWeekDates,
  SLOT_TEMPLATES_BY_DOCTOR,
} from "@/src/lib/appointments";

const DEFAULT_WEEK_START = "2026-04-13";

export default function CalendarViewPage() {
  const [doctorId, setDoctorId] = useState(DOCTORS[0]?.id ?? "");
  const [weekStart, setWeekStart] = useState(DEFAULT_WEEK_START);
  const { appointments, isLoading, error } = useAppointments();
  const { data: blockedDates } = useDoctorUnavailability();

  const selectedDoctor = DOCTORS.find((doctor) => doctor.id === doctorId) ?? DOCTORS[0];
  const weekDates = getWeekDates(weekStart);
  const templateSlots = SLOT_TEMPLATES_BY_DOCTOR[selectedDoctor.id] ?? [];
  const blockedLookup = buildBlockedDayLookup(blockedDates, selectedDoctor.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Calendar View</h1>
          <p className="mt-1 text-sm text-slate-500">
            Weekly doctor calendar with shared-slot conflict control and blocked leave days.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none ring-teal-200 focus:ring"
          >
            {DOCTORS.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setWeekStart(shiftDate(weekStart, -7))}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Previous Week
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(shiftDate(weekStart, 7))}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Next Week
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md transition-all duration-200 hover:bg-teal-50 hover:border-teal-300 hover:scale-[1.03] animate-fade-in">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{selectedDoctor.name}</h2>
            <p className="text-sm text-slate-500">{selectedDoctor.specialty}</p>
          </div>
          <p className="text-sm text-slate-500">Week of {formatDisplayDate(weekStart)}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr>
                <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">
                  Time
                </th>
                {weekDates.map((date) => (
                  <th
                    key={date}
                    className="border border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700"
                  >
                    {formatDisplayDate(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templateSlots.map((slotTemplate) => (
                <tr key={`${slotTemplate.start}-${slotTemplate.end}`}>
                  <td className="border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700">
                    {formatRange(slotTemplate.start, slotTemplate.end)}
                  </td>
                  {weekDates.map((date) => {
                    const clinicView = getSlotStatuses(
                      selectedDoctor.id,
                      date,
                      "Clinic",
                      appointments,
                      blockedLookup,
                    ).find((slot) => slot.start === slotTemplate.start);
                    const onlineView = getSlotStatuses(
                      selectedDoctor.id,
                      date,
                      "Online",
                      appointments,
                      blockedLookup,
                    ).find((slot) => slot.start === slotTemplate.start);
                    const slot = clinicView ?? onlineView;

                    return (
                      <td
                        key={`${date}-${slotTemplate.start}`}
                        className="border border-slate-200 px-3 py-3"
                      >
                        {slot ? <CalendarCell slot={slot} /> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-600">
          <Legend color="bg-emerald-500" label="Clinic slot in use" />
          <Legend color="bg-sky-500" label="Online slot in use" />
          <Legend color="bg-amber-500" label="Open shared slot" />
          <Legend color="bg-slate-400" label="Unavailable or blocked" />
        </div>

        {isLoading ? <p className="mt-4 text-sm text-slate-500">Loading persisted calendar...</p> : null}
      </div>
    </div>
  );
}

function CalendarCell({
  slot,
}: {
  slot: ReturnType<typeof getSlotStatuses>[number];
}) {
  let classes = "bg-amber-100 text-amber-800";
  let summary = "Open";
  let detail = slot.mode === "Both" ? "Available for clinic or online" : `${slot.mode} schedule`;

  if (slot.activeType === "Clinic") {
    classes = "bg-emerald-100 text-emerald-800";
    summary = `Clinic ${slot.bookedCount}/5`;
    detail = `Queue ${slot.queueNumbers.join(", ")}`;
  } else if (slot.activeType === "Online") {
    classes = "bg-sky-100 text-sky-800";
    summary = `Online ${slot.bookedCount}/5`;
    detail = `Queue ${slot.queueNumbers.join(", ")}`;
  } else if (!slot.availableForType) {
    classes = "bg-slate-200 text-slate-600";
    summary = slot.reason;
    detail = slot.mode === "Both" ? "No booking allowed for this slot" : `${slot.mode} schedule`;
  }

  return (
    <div className={`rounded-2xl px-3 py-3 ${classes}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{summary}</p>
      <p className="mt-2 text-xs">{detail}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function shiftDate(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}
