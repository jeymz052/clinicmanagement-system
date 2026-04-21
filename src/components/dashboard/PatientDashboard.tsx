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
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-6 shadow-[0_28px_70px_rgba(16,185,129,0.12)] animate-fade-in-down">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Patient Dashboard</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">Welcome, {name}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Keep track of your bookings, pending payments, and next consultation from one calm workspace.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {upcoming.length} upcoming appointment{upcoming.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="animate-fade-in-up stagger-1">
          <StatCard label="Upcoming" value={upcoming.length} tone="teal" />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <StatCard label="Completed" value={pastCompleted} tone="emerald" />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <StatCard label="Pending Payment" value={pendingPayments.length} tone="amber" />
        </div>
      </div>

      {next ? (
        <div className="rounded-[2rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(135deg,_#f0fdf4,_#ffffff_52%,_#ecfeff)] p-6 shadow-[0_20px_45px_rgba(16,185,129,0.12)] animate-pop-in stagger-4 transition hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Next Appointment</p>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {formatDate(next.date)} · {next.start}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {next.type === "Online" ? "Online consultation" : "Clinic visit"} · Queue #{next.queueNumber}
              </p>
              {next.reason ? <p className="mt-2 text-sm italic text-slate-500">&quot;{next.reason}&quot;</p> : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
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
                  className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5"
                >
                  Join Consultation →
                </a>
              ) : null}
              {next.status === "Pending Payment" ? (
                <Link
                  href="/payments"
                  className="rounded-full bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-amber-700"
                >
                  Pay Now →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {pendingPayments.length > 0 ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 animate-fade-in-up stagger-5 flex items-start gap-3 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 animate-soft-pulse">
            <svg className="h-4 w-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-amber-900">
            You have {pendingPayments.length} appointment{pendingPayments.length === 1 ? "" : "s"} awaiting payment.
          </p>
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Upcoming Appointments</h2>
          <Link href="/appointments/my" className="text-xs font-semibold text-emerald-700 transition-colors hover:text-emerald-800">
            Book another →
          </Link>
        </div>
        {isLoading ? (
          <div className="h-24 rounded-lg shimmer" />
        ) : upcoming.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-emerald-200 px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No upcoming appointments.</p>
            <Link
              href="/appointments"
              className="mt-3 inline-block rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5"
            >
              Book Appointment
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-emerald-50">
            {upcoming.slice(0, 5).map((appt, i) => (
              <div
                key={appt.id}
                className={`flex items-center justify-between py-3 px-2 -mx-2 rounded-[1rem] transition-colors hover:bg-emerald-50/40 animate-slide-in-left stagger-${Math.min(i + 1, 5)}`}
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                    appt.type === "Online" ? "bg-teal-100 text-teal-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    <span className="text-xs font-bold">#{appt.queueNumber}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(appt.date)} · {appt.start}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {appt.type}
                      {appt.reason ? ` · ${appt.reason}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
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

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-7">
        <h2 className="mb-4 text-base font-bold text-slate-900">Quick Actions</h2>
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
  tone,
}: {
  label: string;
  value: number;
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
    <div className={`relative overflow-hidden rounded-[1.75rem] border bg-white p-5 shadow-[0_16px_34px_rgba(16,185,129,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(16,185,129,0.12)] ${toneMap[tone]}`}>
      <div className={`absolute -top-4 -right-4 h-20 w-20 rounded-full opacity-10 ${accentMap[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function QuickAction({ href, label, color }: { href: string; label: string; color: "teal" | "sky" | "amber" }) {
  const colorMap = {
    teal: "border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 text-emerald-700",
    sky: "border-teal-200 hover:bg-teal-50 hover:border-teal-400 text-teal-700",
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
