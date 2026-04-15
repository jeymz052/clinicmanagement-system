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
    <div className="space-y-6">
      <div className="animate-fade-in-down">
        <h1 className="text-2xl font-bold text-slate-900">Good day, {name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your queue and consultations for today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="animate-fade-in-up stagger-1">
          <StatCard label="Today" value={todayQueue.length} hint="Appointments scheduled" tone="teal" />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <StatCard label="Completed today" value={completedToday} hint="Consultations finished" tone="emerald" />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <StatCard label="Pending notes" value={pendingNotes} hint="Consultations missing notes" tone="amber" />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <StatCard label="Total seen" value={totalSeen} hint="All-time completed" tone="slate" />
        </div>
      </div>

      {/* Next-in-queue banner */}
      {nextInQueue ? (
        <div className="relative rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 shadow-sm animate-pop-in stagger-5 hover-lift overflow-hidden">
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-teal-100/50 blur-2xl animate-float-slow" />
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Next in Queue</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {nextInQueue.patientName} · Queue #{nextInQueue.queueNumber}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
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
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Join Meeting →
                </a>
              ) : null}
              <Link
                href="/consultations"
                className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
              >
                Start Consultation →
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Today's queue */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-in-up stagger-6 hover-lift">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500 animate-soft-pulse" />
            Today&apos;s Queue
          </h2>
          <Link href="/appointments/list" className="text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors">
            View full list →
          </Link>
        </div>
        {isLoading ? (
          <div className="h-24 rounded-lg shimmer" />
        ) : todayQueue.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-400">No appointments today. Enjoy the break.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayQueue.map((appt, i) => (
              <div
                key={appt.id}
                className={`flex items-center justify-between py-3 px-2 -mx-2 rounded-lg transition-colors hover:bg-slate-50 animate-slide-in-left stagger-${Math.min(i + 1, 8)}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 transition-transform hover:scale-110 ${
                      appt.status === "Completed" ? "bg-emerald-500" : "bg-teal-600"
                    }`}
                  >
                    {appt.queueNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{appt.patientName}</p>
                    <p className="text-xs text-slate-500">
                      {appt.start} · {appt.type}
                      {appt.reason ? ` · ${appt.reason}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
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

      {/* Upcoming */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-in-up stagger-7 hover-lift">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Upcoming This Week</h2>
          <Link href="/schedules" className="text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors">
            Manage schedule →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No upcoming appointments.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcoming.map((appt, i) => (
              <div
                key={appt.id}
                className={`flex items-center justify-between py-3 px-2 -mx-2 rounded-lg transition-colors hover:bg-slate-50 animate-slide-in-left stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{appt.patientName}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(appt.date)} · {appt.start} · {appt.type}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
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

      {/* Quick actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-in-up stagger-8">
        <h2 className="text-base font-bold text-slate-900 mb-4">Quick Actions</h2>
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
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
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
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm hover-lift ${toneMap[tone]}`}>
      <div className={`absolute -top-4 -right-4 h-16 w-16 rounded-full opacity-10 ${accentMap[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
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
      className={`group flex items-center justify-center gap-1.5 rounded-xl border bg-white px-4 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${colorMap[color]}`}
    >
      <span>{label}</span>
      <span className="opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0">→</span>
    </Link>
  );
}
