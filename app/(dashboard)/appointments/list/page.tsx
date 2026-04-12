"use client";

import { useState, useTransition } from "react";
import {
  deleteAppointmentAction,
  markAppointmentPaidAction,
  updateAppointmentAction,
} from "@/app/(dashboard)/appointments/actions";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  DOCTORS,
  formatDisplayDate,
  formatRange,
  getAppointmentSummary,
  getDoctorById,
  type AppointmentRecord,
  type AppointmentType,
} from "@/src/lib/appointments";

export default function AppointmentListPage() {
  const { accessToken, role } = useRole();
  const { appointments, setAppointments, isLoading, error } = useAppointments();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AppointmentRecord | null>(null);
  const [isUpdating, startUpdateTransition] = useTransition();
  const summary = getAppointmentSummary(appointments);
  // Only show appointments that were booked manually by the patient (assume those with a real patient email, not sample/generic emails)
  const sortedAppointments = [...appointments]
    .filter(a => !a.email.endsWith('@example.com'))
    .sort((left, right) =>
      `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`),
    );
  const canManage = role !== "PATIENT";

  function beginEdit(appointment: AppointmentRecord) {
    setEditingId(appointment.id);
    setDraft(appointment);
    setFeedback(null);
  }

  function updateDraft<K extends keyof AppointmentRecord>(field: K, value: AppointmentRecord[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function saveDraft() {
    if (!accessToken || !draft) {
      setFeedback("Sign in again to continue.");
      return;
    }

    startUpdateTransition(async () => {
      const result = await updateAppointmentAction(accessToken, {
        id: draft.id,
        patientName: draft.patientName,
        email: draft.email,
        phone: draft.phone,
        doctorId: draft.doctorId,
        date: draft.date,
        start: draft.start,
        type: draft.type,
        reason: draft.reason,
      });
      setAppointments(result.appointments);
      setFeedback(result.message);
      if (result.ok) {
        setEditingId(null);
        setDraft(null);
      }
    });
  }

  function deleteAppointment(appointmentId: string) {
    if (!accessToken) {
      setFeedback("Sign in again to continue.");
      return;
    }
    startUpdateTransition(async () => {
      const result = await deleteAppointmentAction(accessToken, appointmentId);
      setAppointments(result.appointments);
      setFeedback(result.message);
    });
  }

  function confirmPayment(appointmentId: string) {
    if (!accessToken) {
      setFeedback("Sign in again to continue.");
      return;
    }
    startUpdateTransition(async () => {
      const result = await markAppointmentPaidAction(accessToken, appointmentId);
      setAppointments(result.appointments);
      setFeedback(result.message);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Appointment List</h1>
        <p className="mt-1 text-sm text-slate-500">
          Full appointment CRUD with shared-slot validation and payment-aware consultation flow.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <SummaryCard label="Total" value={summary.total} tone="slate" />
        <SummaryCard label="Confirmed / Completed" value={summary.confirmedCount} tone="emerald" />
        <SummaryCard label="Pending Payment" value={summary.pendingCount} tone="amber" />
        <SummaryCard label="Online" value={summary.onlineCount} tone="sky" />
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

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md transition-all duration-200 hover:border-teal-300 hover:shadow-lg animate-fade-in">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th className="px-6 py-4 font-semibold">Patient</th>
              <th className="px-6 py-4 font-semibold">Doctor</th>
              <th className="px-6 py-4 font-semibold">Schedule</th>
              <th className="px-6 py-4 font-semibold">Queue</th>
              <th className="px-6 py-4 font-semibold">Type</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedAppointments.map((appointment) => {
              const doctor = getDoctorById(appointment.doctorId);
              const isEditing = editingId === appointment.id && draft !== null;

              return (
                <tr key={appointment.id} className="border-t border-slate-200 align-top">
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={draft.patientName}
                          onChange={(event) => updateDraft("patientName", event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                        <input
                          value={draft.email}
                          onChange={(event) => updateDraft("email", event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-900">{appointment.patientName}</p>
                        <p className="mt-1 text-xs text-slate-500">{appointment.reason}</p>
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select
                        value={draft.doctorId}
                        onChange={(event) => updateDraft("doctorId", event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      >
                        {DOCTORS.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-slate-600">
                        <p>{doctor?.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{doctor?.specialty}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(event) => updateDraft("date", event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                        <input
                          type="time"
                          value={draft.start}
                          onChange={(event) => updateDraft("start", event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                      </div>
                    ) : (
                      <div className="text-slate-600">
                        <p>{formatDisplayDate(appointment.date)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatRange(appointment.start, appointment.end)}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      #{appointment.queueNumber}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select
                        value={draft.type}
                        onChange={(event) => updateDraft("type", event.target.value as AppointmentType)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <option value="Clinic">Clinic</option>
                        <option value="Online">Online</option>
                      </select>
                    ) : (
                      <Badge tone={appointment.type === "Clinic" ? "emerald" : "sky"}>
                        {appointment.type}
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      tone={
                        appointment.status === "Pending Payment"
                          ? "amber"
                          : appointment.status === "Paid"
                            ? "sky"
                            : "emerald"
                      }
                    >
                      {appointment.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {canManage && !isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => beginEdit(appointment)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAppointment(appointment.id)}
                            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-700"
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={saveDraft}
                            className="rounded-lg bg-teal-700 px-3 py-1 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setDraft(null);
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : null}
                      {appointment.type === "Online" && appointment.status === "Pending Payment" ? (
                        <button
                          type="button"
                          onClick={() => confirmPayment(appointment.id)}
                          className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Confirm Payment
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isLoading ? (
          <div className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            Loading appointments...
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "amber" | "sky" }) {
  const styles = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    sky: "text-sky-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md transition-all duration-200 hover:bg-teal-50 hover:border-teal-300 hover:scale-[1.04] animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${styles[tone]}`}>{value}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "emerald" | "amber" | "sky" }) {
  const styles = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}
