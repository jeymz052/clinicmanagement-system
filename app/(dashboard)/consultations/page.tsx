"use client";

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
  const { appointments } = useAppointments();
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
    .filter((appointment) => appointment.type === "Clinic" || appointment.status === "Paid")
    .sort((left, right) => `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`));
  const onlineReady = appointments.filter(
    (appointment) => appointment.type === "Online" && appointment.status === "Paid",
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
      setFeedback("Consultation note saved.");
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Consultations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Start paid online consultations, add consultation notes, and track progress.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Metric label="Ready Online Consultations" value={onlineReady.length.toString()} tone="sky" />
        <Metric label="Consultation Notes Saved" value={notes.length.toString()} tone="emerald" />
        <Metric label="Completed Notes" value={completedCount.toString()} tone="slate" />
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Consultation Queue</h2>
          <div className="mt-5 space-y-4">
            {eligibleAppointments.map((appointment) => {
              const doctor = getDoctorById(appointment.doctorId);
              const note = notes.find((item) => item.appointmentId === appointment.id);
              const isActive = activeAppointmentId === appointment.id;

              return (
                <div key={appointment.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{appointment.patientName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {doctor?.name} | {formatDisplayDate(appointment.date)} |{" "}
                        {formatRange(appointment.start, appointment.end)}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">{appointment.reason}</p>
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
                      className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                    >
                      {appointment.meetingLink ? "Start Online Consultation" : "Open Note Editor"}
                    </button>
                    {appointment.meetingLink ? (
                      <a
                        href={appointment.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-sky-200 px-4 py-2 text-sm font-semibold text-sky-700"
                      >
                        Meeting Link
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
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
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
                          className="mt-2 min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2.5"
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
                          className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                          placeholder="Medication, tests, or follow-up plan"
                        />
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => saveConsultation(appointment)}
                          disabled={isSaving}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                        >
                          {isSaving ? "Saving..." : "Save Consultation Note"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAppointmentId(null)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
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

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Workflow Rules</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <Rule text="Paid online consultations can be started immediately from this page." />
            <Rule text="Pending-payment online appointments stay out of the consultation queue." />
            <Rule text="Clinic and online appointments both support consultation notes." />
            <Rule text="Doctors can capture status, notes, and prescriptions per appointment." />
          </div>
          {isLoading ? <p className="mt-4 text-sm text-slate-500">Loading consultation notes...</p> : null}
        </div>
      </div>
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
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

function Rule({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      {text}
    </div>
  );
}
