"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useConsultationNotes } from "@/src/components/clinic/useClinicData";
import type { AppointmentRecord } from "@/src/lib/appointments";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function cmpAppt(a: AppointmentRecord, b: AppointmentRecord) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.start !== b.start) return a.start.localeCompare(b.start);
  return a.queueNumber - b.queueNumber;
}

export default function DoctorDashboard() {
  const { user } = useRole();
  const name = user?.user_metadata?.full_name ?? "Doctor";
  const { appointments, isLoading } = useAppointments();
  const { data: notes } = useConsultationNotes();

  const today = isoToday();
  const todayQueue = useMemo(
    () => appointments.filter((a) => a.date === today).sort(cmpAppt),
    [appointments, today],
  );
  const upcoming = useMemo(
    () => appointments.filter((a) => a.date > today && a.status !== "Completed").sort(cmpAppt).slice(0, 6),
    [appointments, today],
  );
  const completedToday = useMemo(
    () => todayQueue.filter((a) => a.status === "Completed").length,
    [todayQueue],
  );
  const pendingNotes = useMemo(
    () => {
      const notedIds = new Set(notes.map((n) => n.appointmentId));
      return appointments.filter(
        (a) =>
          (a.status === "Completed" || a.status === "Confirmed" || a.status === "Paid") &&
          !notedIds.has(a.id),
      ).length;
    },
    [appointments, notes],
  );

  const totalSeen = appointments.filter((a) => a.status === "Completed").length;
  const nextInQueue = todayQueue.find((a) => a.status !== "Completed");

  return (
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-6 shadow-[0_28px_70px_rgba(16,185,129,0.12)] animate-fade-in-down">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Doctor Dashboard</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">Good day, {name}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Stay focused on your queue, upcoming patients, and remaining consultation notes.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {todayQueue.length} patients in queue
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="animate-fade-in-up stagger-1">
          <StatCard label="Today" value={todayQueue.length} tone="teal" />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <StatCard label="Completed today" value={completedToday} tone="emerald" />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <StatCard label="Pending notes" value={pendingNotes} tone="amber" />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <StatCard label="Total seen" value={totalSeen} tone="slate" />
        </div>
      </div>

      {nextInQueue ? (
        <div className="relative overflow-hidden rounded-[2rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(135deg,_#f0fdf4,_#ffffff_52%,_#ecfeff)] p-6 shadow-[0_20px_45px_rgba(16,185,129,0.12)] animate-pop-in stagger-5 transition hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Next in Queue</p>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {nextInQueue.patientName} · Queue #{nextInQueue.queueNumber}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {nextInQueue.start} · {nextInQueue.type}
                {nextInQueue.reason ? ` · ${nextInQueue.reason}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {nextInQueue.type === "Online" && nextInQueue.meetingLink ? (
                <a
                  href={nextInQueue.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5"
                >
                  Join Meeting →
                </a>
              ) : null}
              <Link
                href="/consultations"
                className="rounded-full border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Start Consultation →
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-soft-pulse" />
            Today&apos;s Queue
          </h2>
          <Link href="/appointments/list" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors">
            View full list →
          </Link>
        </div>
        {isLoading ? (
          <div className="h-24 rounded-lg shimmer" />
        ) : todayQueue.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-400">No appointments today. Enjoy the break.</p>
          </div>
        ) : (
          <div className="divide-y divide-emerald-50">
            {todayQueue.map((appt, i) => (
              <div
                key={appt.id}
                className={`flex items-center justify-between py-3 px-2 -mx-2 rounded-[1rem] transition-colors hover:bg-emerald-50/40 animate-slide-in-left stagger-${Math.min(i + 1, 8)}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 ${
                      appt.status === "Completed" ? "bg-emerald-500" : "bg-teal-600"
                    }`}
                  >
                    {appt.queueNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{appt.patientName}</p>
                    <p className="text-xs text-slate-500">
                      {appt.start} · {appt.type}
                      {appt.reason ? ` · ${appt.reason}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${
                    appt.status === "Completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : appt.status === "Pending Payment"
                        ? "bg-amber-50 text-amber-700"
                        : appt.type === "Online"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-teal-50 text-teal-700"
                  }`}
                >
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-7">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Upcoming This Week</h2>
          <Link href="/schedules" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors">
            Manage schedule →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No upcoming appointments.</p>
        ) : (
          <div className="divide-y divide-emerald-50">
            {upcoming.map((appt, i) => (
              <div
                key={appt.id}
                className={`flex items-center justify-between py-3 px-2 -mx-2 rounded-[1rem] transition-colors hover:bg-emerald-50/40 animate-slide-in-left stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{appt.patientName}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(appt.date)} · {appt.start} · {appt.type}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${
                    appt.type === "Online" ? "bg-sky-50 text-sky-700" : "bg-teal-50 text-teal-700"
                  }`}
                >
                  Q#{appt.queueNumber}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-8">
        <h2 className="mb-4 text-base font-bold text-slate-900">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAction href="/consultations" label="Consultations" color="teal" />
          <QuickAction href="/consultations/history" label="Patient History" color="sky" />
          <QuickAction href="/schedules" label="My Schedule" color="emerald" />
          <QuickAction href="/schedules/slots" label="Block Time" color="amber" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "emerald" | "amber" | "slate";
}) {
  const toneMap = {
    teal: "border-teal-200 bg-teal-50/50 hover:border-teal-300",
    emerald: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300",
    amber: "border-amber-200 bg-amber-50/50 hover:border-amber-300",
    slate: "border-slate-200 hover:border-slate-300",
  };
  const accentMap = {
    teal: "bg-teal-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    slate: "bg-slate-400",
  };
  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] border bg-white p-5 shadow-[0_16px_34px_rgba(16,185,129,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(16,185,129,0.12)] ${toneMap[tone]}`}>
      <div className={`absolute -top-4 -right-4 h-20 w-20 rounded-full opacity-10 ${accentMap[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  label,
  color,
}: {
  href: string;
  label: string;
  color: "teal" | "sky" | "emerald" | "amber";
}) {
  const colorMap = {
    teal: "border-teal-200 hover:bg-teal-50 hover:border-teal-400 text-teal-700",
    sky: "border-sky-200 hover:bg-sky-50 hover:border-sky-400 text-sky-700",
    emerald: "border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 text-emerald-700",
    amber: "border-amber-200 hover:bg-amber-50 hover:border-amber-400 text-amber-700",
  };
  return (
    <Link
      href={href}
      className={`group flex items-center justify-center gap-1.5 rounded-[1.2rem] border bg-white px-4 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_16px_30px_rgba(16,185,129,0.10)] ${colorMap[color]}`}
    >
      <span>{label}</span>
      <span className="opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0">→</span>
    </Link>
  );
}
