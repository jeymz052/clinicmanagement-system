"use client";

import Link from "next/link";
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

function getCurrentWeekStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

export default function CalendarViewPage() {
  const [doctorId, setDoctorId] = useState(DOCTORS[0]?.id ?? "");
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const { appointments, isLoading, error } = useAppointments();
  const { data: blockedDates } = useDoctorUnavailability();

  const selectedDoctor = DOCTORS.find((doctor) => doctor.id === doctorId) ?? DOCTORS[0];
  const weekDates = getWeekDates(weekStart);
  const templateSlots = SLOT_TEMPLATES_BY_DOCTOR[selectedDoctor.id] ?? [];
  const blockedLookup = buildBlockedDayLookup(blockedDates, selectedDoctor.id);

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-6 shadow-[0_28px_70px_rgba(16,185,129,0.12)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Calendar</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">Shared weekly availability at a glance</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Compare clinic and online slots, then jump straight to the right appointment page when you need it.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Shortcut href="/appointments" label="Appointments" />
            <Shortcut href="/appointments/my" label="My Appointments" />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{selectedDoctor.name}</h2>
            <p className="text-sm text-slate-500">{selectedDoctor.specialty}</p>
          </div>
          <p className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 whitespace-nowrap">
            Week of {formatDisplayDate(weekStart)}
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 border-t border-emerald-100 pt-4">
          <span className="text-sm font-semibold text-slate-600">Filter by:</span>
          <select
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            className="rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 hover:border-emerald-300"
          >
            {DOCTORS.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
          
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setWeekStart(shiftDate(weekStart, -7))}
              className="rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100"
              title="Show previous week"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(getCurrentWeekStart())}
              className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
              title="Return to current week"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(shiftDate(weekStart, 7))}
              className="rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100"
              title="Show next week"
            >
              Next →
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[1.5rem] border border-emerald-100">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr>
                <th className="border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-left font-semibold text-slate-700">
                  Time
                </th>
                {weekDates.map((date) => (
                  <th
                    key={date}
                    className="border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-left font-semibold text-slate-700"
                  >
                    {formatDisplayDate(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templateSlots.map((slotTemplate) => (
                <tr key={`${slotTemplate.start}-${slotTemplate.end}`}>
                  <td className="border border-emerald-100 bg-emerald-50/40 px-4 py-3 font-medium text-slate-700">
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
                        className="border border-emerald-100 px-3 py-3"
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
    <div className={`rounded-[1.25rem] px-3 py-3 shadow-sm ${classes}`}>
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

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-emerald-100 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
    >
      {label}
    </Link>
  );
}
