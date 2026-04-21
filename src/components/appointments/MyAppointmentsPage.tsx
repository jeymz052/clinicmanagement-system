"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";

type MyAppointmentsPageProps = {
  title?: string;
  description?: string;
};

export default function MyAppointmentsPage({
  title = "My Appointments",
  description = "Track your bookings, queue numbers, payment steps, and meeting access in one place.",
}: MyAppointmentsPageProps) {
  const { appointments, isLoading, error } = useAppointments();
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");
  const today = getClinicToday();

  const upcoming = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.date >= today && appointment.status !== "Completed")
        .sort((left, right) => `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`)),
    [appointments, today],
  );

  const history = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.date < today || appointment.status === "Completed")
        .sort((left, right) => `${right.date} ${right.start}`.localeCompare(`${left.date} ${left.start}`)),
    [appointments, today],
  );

  const pendingPaymentCount = appointments.filter((appointment) => appointment.status === "Pending Payment").length;
  const onlineReadyCount = appointments.filter((appointment) => appointment.type === "Online" && appointment.meetingLink).length;
  const nextAppointment = upcoming[0] ?? null;
  const visibleAppointments = activeTab === "upcoming" ? upcoming : history;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Link
          href="/appointments"
          className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Book Another Appointment
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Upcoming" value={upcoming.length} hint="Scheduled visits ahead" tone="teal" />
        <MetricCard label="Pending Payment" value={pendingPaymentCount} hint="Online consults awaiting payment" tone="amber" />
        <MetricCard label="Meeting Links Ready" value={onlineReadyCount} hint="Online consults ready to join" tone="sky" />
      </div>

      {nextAppointment ? (
        <div className="rounded-3xl border border-teal-200 bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.12),_transparent_28%),linear-gradient(135deg,_#f0fdfa,_#ffffff_55%,_#eff6ff)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Next Appointment</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatDisplayDate(nextAppointment.date)} | {formatRange(nextAppointment.start, nextAppointment.end)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {getDoctorById(nextAppointment.doctorId)?.name ?? "Assigned doctor"} | {nextAppointment.type} | Queue #{nextAppointment.queueNumber}
              </p>
              {nextAppointment.reason ? (
                <p className="mt-2 text-sm text-slate-500">{nextAppointment.reason}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {nextAppointment.status === "Pending Payment" ? (
                <Link
                  href={`/payments?appointmentId=${nextAppointment.id}`}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Complete Payment
                </Link>
              ) : null}
              {nextAppointment.meetingLink ? (
                <a
                  href={nextAppointment.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Join Consultation
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <TabButton label="Upcoming" active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")} />
          <TabButton label="History" active={activeTab === "history"} onClick={() => setActiveTab("history")} />
        </div>

        {isLoading ? (
          <div className="px-5 py-8">
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : visibleAppointments.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-500">
              {activeTab === "upcoming" ? "You have no upcoming appointments." : "No completed or past appointments yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleAppointments.map((appointment) => {
              const doctor = getDoctorById(appointment.doctorId);
              return (
                <div key={appointment.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDisplayDate(appointment.date)} | {formatRange(appointment.start, appointment.end)}
                      </p>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {doctor?.name ?? "Assigned doctor"} | {appointment.type} | Queue #{appointment.queueNumber}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {appointment.reason || "No consultation reason provided."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {appointment.status === "Pending Payment" ? (
                      <Link
                        href={`/payments?appointmentId=${appointment.id}`}
                        className="rounded-lg border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                      >
                        Complete Payment
                      </Link>
                    ) : null}
                    {appointment.meetingLink ? (
                      <a
                        href={appointment.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                      >
                        Open Meeting Link
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "teal" | "amber" | "sky";
}) {
  const accent = {
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 ${accent[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-semibold ${
        active ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Pending Payment"
      ? "bg-amber-50 text-amber-700"
      : status === "Completed"
        ? "bg-emerald-50 text-emerald-700"
        : status === "Paid"
          ? "bg-sky-50 text-sky-700"
          : "bg-teal-50 text-teal-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}
