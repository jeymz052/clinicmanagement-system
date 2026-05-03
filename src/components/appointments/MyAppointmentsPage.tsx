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
  description = "",
}: MyAppointmentsPageProps) {
  const { appointments, isLoading, error } = useAppointments();
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");
  const today = getClinicToday();

  const upcoming = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.date >= today &&
            appointment.status !== "Completed",
        )
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

  const onlineReadyCount = appointments.filter((appointment) => appointment.type === "Online" && appointment.meetingLink).length;
  const nextAppointment = upcoming[0] ?? null;
  const visibleAppointments = activeTab === "upcoming" ? upcoming : history;

  return (
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-6 shadow-[0_28px_70px_rgba(16,185,129,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Appointments</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        <Link
          href="/appointments"
            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)]"
        >
          Book Another Appointment
        </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Upcoming" value={upcoming.length} tone="teal" />
        <MetricCard label="Completed" value={history.length} tone="amber" />
        <MetricCard label="Meeting Links Ready" value={onlineReadyCount} tone="sky" />
      </div>

      {nextAppointment ? (
        <div className="rounded-[2rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(135deg,_#f0fdf4,_#ffffff_55%,_#ecfeff)] p-6 shadow-[0_20px_45px_rgba(16,185,129,0.12)] transition hover:-translate-y-0.5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Next Appointment</p>
              <p className="mt-2 text-2xl font-black text-slate-900">
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
              {nextAppointment.meetingLink ? (
                <a
                  href={nextAppointment.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700"
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

      <div className="rounded-[2rem] border border-emerald-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2 border-b border-emerald-100 px-5 py-4">
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
          <div className="divide-y divide-emerald-50">
            {visibleAppointments.map((appointment) => {
              const doctor = getDoctorById(appointment.doctorId);
              return (
                <div key={appointment.id} className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-emerald-50/40 lg:flex-row lg:items-center lg:justify-between">
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
                    {appointment.meetingLink ? (
                      <a
                        href={appointment.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
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
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "amber" | "sky";
}) {
  const accent = {
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-[0_16px_34px_rgba(16,185,129,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(16,185,129,0.12)]">
      <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10 ${accent[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-[linear-gradient(135deg,#059669,#10b981)] text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "In Progress"
      ? "bg-amber-50 text-amber-700"
      : status === "Completed"
        ? "bg-emerald-50 text-emerald-700"
        : status === "Confirmed"
          ? "bg-sky-50 text-sky-700"
          : "bg-teal-50 text-teal-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}
