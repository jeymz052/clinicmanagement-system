"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useConsultationNotes } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  formatDisplayDate,
  formatRange,
  getDoctorById,
  type AppointmentRecord,
} from "@/src/lib/appointments";
import type { ConsultationProgress } from "@/src/lib/clinic";

type DraftState = {
  note: string;
  prescription: string;
  status: ConsultationProgress;
};

export default function OnlineConsultationPage() {
  const { accessToken, role } = useRole();
  const { appointments, setAppointments } = useAppointments();
  const { data: notes, setData: setNotes, isLoading, error } = useConsultationNotes();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>({
    note: "",
    prescription: "",
    status: "Ready",
  });
  const [isSaving, startTransition] = useTransition();

  const eligibleAppointments = appointments
    .filter((appointment) => {
      if (appointment.type === "Clinic") {
        return (
          appointment.status === "Confirmed" ||
          appointment.status === "In Progress" ||
          appointment.status === "Completed"
        );
      }
      return appointment.status === "Confirmed" || appointment.status === "In Progress" || appointment.status === "Completed";
    })
    .sort((left, right) => `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`));
  const onlineReady = appointments.filter(
    (appointment) => appointment.type === "Online" && appointment.status === "Confirmed",
  );
  const completedCount = notes.filter((note) => note.status === "Completed").length;
  const canManage = role !== "PATIENT";

  function openConsultation(appointment: AppointmentRecord) {
    const existing = notes.find((note) => note.appointmentId === appointment.id);
    setActiveAppointmentId(appointment.id);
    setDraft({
      note: existing?.note ?? "",
      prescription: existing?.prescription ?? "",
      status: existing?.status ?? "Ready",
    });
    setFeedback(null);

    if (appointment.meetingLink) {
      window.open(appointment.meetingLink, "_blank", "noopener,noreferrer");
    }
  }

  function saveConsultation(appointment: AppointmentRecord) {
    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    startTransition(async () => {
      const existing = notes.find((note) => note.appointmentId === appointment.id);
      const response = await fetch("/api/consultation-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: existing?.id,
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          patientName: appointment.patientName,
          note: draft.note,
          prescription: draft.prescription,
          status: draft.status,
        }),
      });

      if (!response.ok) {
        setFeedback("Unable to save consultation note.");
        return;
      }

      const payload = (await response.json()) as { data: typeof notes };
      setNotes(payload.data);
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointment.id
            ? {
                ...item,
                status:
                  draft.status === "Completed"
                    ? "Completed"
                        : draft.status === "In Progress"
                          ? "In Progress"
                          : appointment.type === "Online"
                        ? "Confirmed"
                        : "Confirmed",
              }
            : item,
        ),
      );
      setFeedback("Consultation note saved.");
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),linear-gradient(135deg,#f8fffb_0%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(16,185,129,0.10)] animate-fade-in-down">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Consultations</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Move from queue to note-taking without extra clicks</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Start sessions, write notes, and keep progress organized with a calmer live-workflow layout.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Shortcut href="/consultations/history" label="History" />
            <Shortcut href="/appointments/list" label="Appointments" />
            <Shortcut href="/schedules" label="Schedules" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="animate-fade-in-up stagger-1">
          <Metric label="Ready Online Consultations" value={onlineReady.length.toString()} tone="sky" />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <Metric label="Consultation Notes Saved" value={notes.length.toString()} tone="emerald" />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <Metric label="Completed Notes" value={completedCount.toString()} tone="slate" />
        </div>
      </div>

      {feedback ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] hover-lift animate-fade-in-up stagger-4">
          <h2 className="text-lg font-bold text-slate-900">Consultation Queue</h2>
          <div className="mt-5 space-y-4">
            {eligibleAppointments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                  <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">No consultations ready yet.</p>
              </div>
            ) : null}
            {eligibleAppointments.map((appointment, i) => {
              const doctor = getDoctorById(appointment.doctorId);
              const note = notes.find((item) => item.appointmentId === appointment.id);
              const isActive = activeAppointmentId === appointment.id;

              return (
                <div
                  key={appointment.id}
                  className={`rounded-2xl border border-slate-200 p-4 transition-all hover:border-teal-300 hover:shadow-md animate-slide-in-left stagger-${Math.min(i + 1, 6)} ${
                    isActive ? "ring-2 ring-teal-300 border-teal-300" : ""
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{appointment.patientName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {doctor?.name} · {formatDisplayDate(appointment.date)} ·{" "}
                        {formatRange(appointment.start, appointment.end)}
                      </p>
                      {appointment.reason ? (
                        <p className="mt-2 text-sm text-slate-500 italic">&quot;{appointment.reason}&quot;</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={appointment.type === "Online" ? "sky" : "emerald"}>
                        {appointment.type}
                      </Badge>
                      <Badge tone={note?.status === "Completed" ? "emerald" : "amber"}>
                        {note?.status ?? "Ready"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openConsultation(appointment)}
                      className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.20)] transition-all hover:-translate-y-0.5"
                    >
                      {appointment.meetingLink ? "Start Online Consultation" : "Open Note Editor"}
                    </button>
                    {appointment.meetingLink ? (
                      <a
                        href={appointment.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-sky-200 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 transition-colors"
                      >
                        Meeting Link →
                      </a>
                    ) : null}
                  </div>

                  {isActive && canManage ? (
                    <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="block text-sm font-medium text-slate-700">
                        Consultation Status
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              status: event.target.value as ConsultationProgress,
                            }))
                          }
                          className="mt-2 w-full rounded-[1rem] border border-emerald-100 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        >
                          <option value="Ready">Ready</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Consultation Notes
                        <textarea
                          value={draft.note}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, note: event.target.value }))
                          }
                          className="mt-2 min-h-32 w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                          placeholder="Assessment, progress, symptoms, and recommendations"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Prescription / Plan
                        <textarea
                          value={draft.prescription}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              prescription: event.target.value,
                            }))
                          }
                          className="mt-2 min-h-24 w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                          placeholder="Medication, tests, or follow-up plan"
                        />
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => saveConsultation(appointment)}
                          disabled={isSaving}
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                        >
                          {isSaving ? "Saving..." : "Save Consultation Note"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAppointmentId(null)}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

      </div>
      {isLoading ? <p className="text-sm text-slate-500">Loading consultation notes...</p> : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "emerald" | "slate";
}) {
  const styles = {
    sky: "text-sky-600",
    emerald: "text-emerald-600",
    slate: "text-slate-900",
  };
  const accent = {
    sky: "bg-sky-500",
    emerald: "bg-emerald-500",
    slate: "bg-slate-400",
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover-lift">
      <div className={`absolute -top-4 -right-4 h-16 w-16 rounded-full opacity-10 ${accent[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${styles[tone]}`}>{value}</p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "sky" | "emerald" | "amber";
}) {
  const styles = {
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
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
