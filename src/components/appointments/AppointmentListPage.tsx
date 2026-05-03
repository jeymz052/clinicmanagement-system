"use client";

import { type ReactNode, useState, useTransition } from "react";
import {
  deleteAppointmentAction,
  updateAppointmentAction,
} from "@/app/(dashboard)/appointments/actions";
import { SharedSlotPicker } from "@/src/components/appointments/SharedSlotPicker";
import { useAppointmentAvailability } from "@/src/components/appointments/useAppointmentAvailability";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  formatDisplayDate,
  formatRange,
  getAppointmentSummary,
  getDoctorById,
  type AppointmentRecord,
  type AppointmentType,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";

const today = getClinicToday();
const DEFAULT_DOCTOR_ID = "chiara-punzalan";

export default function AppointmentListPage() {
  const { accessToken, role } = useRole();
  const { doctors } = useDoctors();
  const { appointments, setAppointments, isLoading, error } = useAppointments();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AppointmentRecord | null>(null);
  const [isUpdating, startUpdateTransition] = useTransition();
  const summary = getAppointmentSummary(appointments);
  const primaryDoctor = doctors[0] ?? null;
  const sortedAppointments = [...appointments].sort((left, right) =>
    `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`),
  );
  const canManage = role !== "PATIENT";
  const activeDraftDoctorId = primaryDoctor?.slug ?? draft?.doctorId ?? DEFAULT_DOCTOR_ID;
  const activeDraftDate = draft?.date ?? today;
  const activeDraftType = draft?.type ?? "Clinic";
  const {
    slotStatuses,
    blockedReason,
    nextAvailableSlot,
    isLoading: isLoadingAvailability,
  } = useAppointmentAvailability(activeDraftDoctorId, activeDraftDate, activeDraftType);

  function beginEdit(appointment: AppointmentRecord) {
    setEditingId(appointment.id);
    setDraft({
      ...appointment,
      doctorId: primaryDoctor?.slug ?? appointment.doctorId ?? DEFAULT_DOCTOR_ID,
    });
    setFeedback(null);
  }

  function updateDraft<K extends keyof AppointmentRecord>(field: K, value: AppointmentRecord[K]) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [field]: value };
      if (field === "doctorId" || field === "date" || field === "type") {
        next.start = "";
        next.end = "";
      }
      return next;
    });
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

  return (
    <div className="space-y-6 pb-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Total" value={summary.total} tone="slate" />
        <SummaryCard label="Confirmed / Completed" value={summary.confirmedCount} tone="emerald" />
        <SummaryCard label="In Progress" value={summary.pendingCount} tone="amber" />
        <SummaryCard label="Online" value={summary.onlineCount} tone="sky" />
      </div>

      {feedback ? (
        <div className="rounded-2xl border-l-4 border-emerald-500 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 shadow-sm">
          ✓ {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border-l-4 border-red-500 bg-red-50 px-5 py-4 text-sm font-medium text-red-800 shadow-sm">
          ✕ {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {sortedAppointments.map((appointment) => {
          const doctor = doctors.find((item) => item.id === appointment.doctorId)
            ?? (appointment.doctorId ? getDoctorById(appointment.doctorId) : null);
          const isEditing = editingId === appointment.id && draft !== null;

          return (
            <article key={appointment.id} className="overflow-hidden rounded-[2rem] border border-emerald-200 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg">
              <div className="flex flex-col gap-5 border-b border-emerald-50 px-6 py-5 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5 mb-3">
                    <h2 className="text-lg font-bold text-slate-900">{appointment.patientName}</h2>
                    <Badge tone={appointment.type === "Clinic" ? "emerald" : "sky"}>{appointment.type}</Badge>
                    <Badge
                      tone={
                        appointment.status === "In Progress"
                          ? "amber"
                          : "emerald"
                      }
                    >
                      {appointment.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {doctor?.name ?? "Assigned doctor"} · {formatDisplayDate(appointment.date)} · {formatRange(appointment.start, appointment.end)}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-emerald-700 bg-emerald-50 w-fit px-3 py-1 rounded-full">Queue #{appointment.queueNumber}</p>
                  <p className="mt-2 text-sm text-slate-600">{appointment.reason || "No consultation reason provided."}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {appointment.meetingLink ? (
                    <a href={appointment.meetingLink} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                      Open Meeting Link
                    </a>
                  ) : null}
                  {canManage && !isEditing ? (
                    <>
                      <button type="button" onClick={() => beginEdit(appointment)} className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteAppointment(appointment.id)} className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition">
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-6 px-6 py-6 bg-gradient-to-b from-white to-emerald-50/20">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-sm">
                      <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">Patient Details</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <input value={draft.patientName} onChange={(event) => updateDraft("patientName", event.target.value)} className="w-full rounded-lg border border-emerald-300 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" placeholder="Patient name" />
                        <input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} className="w-full rounded-lg border border-emerald-300 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" placeholder="Email" />
                        <input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} className="w-full rounded-lg border border-emerald-300 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" placeholder="Phone" />
                        <input value={draft.reason} onChange={(event) => updateDraft("reason", event.target.value)} className="w-full rounded-lg border border-emerald-300 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" placeholder="Reason" />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-sm">
                      <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">Schedule Details</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="w-full rounded-lg border border-emerald-300 bg-emerald-100/50 px-4 py-3 text-sm font-bold text-slate-900">
                          {primaryDoctor?.name ?? getDoctorById(DEFAULT_DOCTOR_ID)?.name ?? "Dra. Chiara C. Punzalan M.D."}
                        </div>
                        <select value={draft.type} onChange={(event) => updateDraft("type", event.target.value as AppointmentType)} className="w-full rounded-lg border border-emerald-300 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 bg-white">
                          <option value="Clinic">Clinic</option>
                          <option value="Online">Online</option>
                        </select>
                        <input type="date" min={today} value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} className="w-full rounded-lg border border-emerald-300 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 bg-white" />
                        {nextAvailableSlot ? (
                          <button
                            type="button"
                            onClick={() => {
                              updateDraft("date", nextAvailableSlot.date);
                              updateDraft("start", nextAvailableSlot.slot.start);
                              updateDraft("end", nextAvailableSlot.slot.end);
                            }}
                            className="rounded-lg border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Use next available
                          </button>
                        ) : (
                          <div className="rounded-lg border border-emerald-300 bg-white px-4 py-3 text-sm text-slate-600">
                            Pick a date to load times
                          </div>
                        )}
                      </div>
                      {blockedReason ? (
                        <div className="mt-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                          ⚠ {blockedReason}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <SharedSlotPicker
                    slotStatuses={slotStatuses}
                    selectedStart={draft.start}
                    onSelect={(start) => {
                      const selected = slotStatuses.find((slot) => slot.start === start);
                      updateDraft("start", start);
                      updateDraft("end", selected?.end ?? "");
                    }}
                    disabled={isUpdating}
                    loading={isLoadingAvailability}
                  />

                  <div className="flex flex-col gap-3 border-t border-emerald-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
                    <button type="button" onClick={() => { setEditingId(null); setDraft(null); }} className="order-2 sm:order-1 rounded-lg border border-emerald-300 px-6 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
                      Cancel
                    </button>
                    <button type="button" onClick={saveDraft} disabled={isUpdating || !draft.start} className="order-1 sm:order-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-60">
                      {isUpdating ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500">Loading appointments...</div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "amber" | "sky" }) {
  const styles = {
    slate: "from-slate-600 to-slate-700 text-slate-600",
    emerald: "from-emerald-600 to-emerald-700 text-emerald-600",
    amber: "from-amber-600 to-amber-700 text-amber-600",
    sky: "from-sky-600 to-sky-700 text-sky-600",
  };
  return (
    <div className="group overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-md transition-all hover:shadow-lg hover:-translate-y-1">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-700 transition">{label}</p>
      <div className={`mt-4 text-4xl font-black bg-gradient-to-r ${styles[tone]} bg-clip-text text-transparent`}>{value}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "emerald" | "amber" | "sky" }) {
  const styles = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}
