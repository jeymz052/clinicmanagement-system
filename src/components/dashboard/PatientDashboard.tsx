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
  const email = user?.email ?? "";
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back{email ? `, ${email.split("@")[0]}` : ""}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your appointments and consultations at a glance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming" value={upcoming.length} hint="All scheduled visits" tone="teal" />
        <StatCard label="Completed" value={pastCompleted} hint="Consultations finished" tone="emerald" />
        <StatCard label="Pending Payment" value={pendingPayments.length} hint="Needs settling" tone="amber" />
      </div>

      {/* Next appointment card */}
      {next ? (
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Next Appointment</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatDate(next.date)} · {next.start}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                {next.type === "Online" ? "Online consultation" : "Clinic visit"} · Queue #{next.queueNumber}
              </p>
              {next.reason ? <p className="text-sm text-slate-500 mt-1 italic">"{next.reason}"</p> : null}
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
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            You have {pendingPayments.length} appointment{pendingPayments.length === 1 ? "" : "s"} awaiting payment.
            Online consultations require payment before the meeting link is generated.
          </p>
        </div>
      ) : null}

      {/* Upcoming appointments list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Upcoming Appointments</h2>
          <Link href="/appointments" className="text-xs font-semibold text-teal-700 hover:text-teal-800">
            Book another →
          </Link>
        </div>
        {isLoading ? (
          <div className="h-24 rounded-lg bg-slate-50 animate-pulse" />
        ) : upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center">
            <p className="text-sm text-slate-500">No upcoming appointments.</p>
            <Link
              href="/appointments"
              className="mt-3 inline-block rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Book Appointment
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcoming.slice(0, 5).map((appt) => (
              <div key={appt.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDate(appt.date)} · {appt.start}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {appt.type} · Queue #{appt.queueNumber}
                    {appt.reason ? ` · ${appt.reason}` : ""}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    appt.type === "Online" ? "bg-sky-50 text-sky-700" : "bg-teal-50 text-teal-700"
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction href="/appointments" label="Book Appointment" color="teal" />
          <QuickAction href="/appointments/list" label="View History" color="sky" />
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
    teal: "border-teal-200 bg-teal-50/50",
    emerald: "border-emerald-200 bg-emerald-50/50",
    amber: "border-amber-200 bg-amber-50/50",
  };
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${toneMap[tone]}`}>
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
      className={`flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${colorMap[color]}`}
    >
      {label}
    </Link>
  );
}
