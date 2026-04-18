"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import { useAppointments } from "@/src/components/appointments/useAppointments";
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

function upcomingComparator(a: AppointmentRecord, b: AppointmentRecord) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.start.localeCompare(b.start);
}

export default function PatientDashboard() {
  const { user } = useRole();
  const name =
    user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Patient";
  const { appointments, isLoading } = useAppointments();

  const today = isoToday();
  const upcoming = useMemo(
    () => appointments.filter((a) => a.date >= today && a.status !== "Completed").sort(upcomingComparator),
    [appointments, today],
  );
  const pastCompleted = useMemo(
    () => appointments.filter((a) => a.status === "Completed").length,
    [appointments],
  );
  const pendingPayments = useMemo(
    () => appointments.filter((a) => a.status === "Pending Payment"),
    [appointments],
  );

  const next = upcoming[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-down">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your appointments and consultations at a glance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="animate-fade-in-up stagger-1">
          <StatCard label="Upcoming" value={upcoming.length} hint="All scheduled visits" tone="teal" />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <StatCard label="Completed" value={pastCompleted} hint="Consultations finished" tone="emerald" />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <StatCard label="Pending Payment" value={pendingPayments.length} hint="Needs settling" tone="amber" />
        </div>
      </div>

      {/* Next appointment card */}
      {next ? (
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 shadow-sm animate-pop-in stagger-4 hover-lift">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Next Appointment</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatDate(next.date)} · {next.start}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                {next.type === "Online" ? "Online consultation" : "Clinic visit"} · Queue #{next.queueNumber}
              </p>
              {next.reason ? <p className="text-sm text-slate-500 mt-1 italic">&quot;{next.reason}&quot;</p> : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  next.status === "Paid" || next.status === "Confirmed"
                    ? "bg-emerald-100 text-emerald-700"
                    : next.status === "Pending Payment"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {next.status}
              </span>
              {next.type === "Online" && next.meetingLink ? (
                <a
                  href={next.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Join Consultation →
                </a>
              ) : null}
              {next.status === "Pending Payment" ? (
                <Link
                  href="/payments"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Pay Now →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Pending payments warning */}
      {pendingPayments.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 animate-fade-in-up stagger-5 flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 animate-soft-pulse">
            <svg className="h-4 w-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-amber-900">
            You have {pendingPayments.length} appointment{pendingPayments.length === 1 ? "" : "s"} awaiting payment.
            Online consultations require payment before the meeting link is generated.
          </p>
        </div>
      ) : null}

      {/* Upcoming appointments list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-in-up stagger-6 hover-lift">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Upcoming Appointments</h2>
          <Link href="/appointments/my" className="text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors">
            Book another →
          </Link>
        </div>
        {isLoading ? (
          <div className="h-24 rounded-lg shimmer" />
        ) : upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-teal-50 flex items-center justify-center mb-3">
              <svg className="h-6 w-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No upcoming appointments.</p>
            <Link
              href="/appointments"
              className="mt-3 inline-block rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 transition-all hover:scale-105"
            >
              Book Appointment
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcoming.slice(0, 5).map((appt, i) => (
              <div
                key={appt.id}
                className={`flex items-center justify-between py-3 px-2 -mx-2 rounded-lg transition-colors hover:bg-slate-50 animate-slide-in-left stagger-${Math.min(i + 1, 5)}`}
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                    appt.type === "Online" ? "bg-sky-100 text-sky-700" : "bg-teal-100 text-teal-700"
                  }`}>
                    <span className="text-xs font-bold">#{appt.queueNumber}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(appt.date)} · {appt.start}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {appt.type}
                      {appt.reason ? ` · ${appt.reason}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    appt.status === "Paid" || appt.status === "Confirmed"
                      ? "bg-emerald-50 text-emerald-700"
                      : appt.status === "Pending Payment"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-in-up stagger-7">
        <h2 className="text-base font-bold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction href="/appointments" label="Book Appointment" color="teal" />
          <QuickAction href="/appointments/my" label="My Appointments" color="sky" />
          <QuickAction href="/payments" label="Payments" color="amber" />
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
  tone: "teal" | "emerald" | "amber";
}) {
  const toneMap = {
    teal: "border-teal-200 bg-teal-50/50 hover:border-teal-300",
    emerald: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300",
    amber: "border-amber-200 bg-amber-50/50 hover:border-amber-300",
  };
  const accentMap = {
    teal: "bg-teal-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
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

function QuickAction({ href, label, color }: { href: string; label: string; color: "teal" | "sky" | "amber" }) {
  const colorMap = {
    teal: "border-teal-200 hover:bg-teal-50 hover:border-teal-400 text-teal-700",
    sky: "border-sky-200 hover:bg-sky-50 hover:border-sky-400 text-sky-700",
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
