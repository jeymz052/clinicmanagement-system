"use client";

import { type ReactNode, useState, useTransition } from "react";
import {
  deleteAppointmentAction,
  markAppointmentPaidAction,
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

type AppointmentListPageProps = {
  title?: string;
  description?: string;
};

const today = getClinicToday();

export default function AppointmentListPage({
  title = "Appointment List",
  description = "",
}: AppointmentListPageProps) {
  const { accessToken, role } = useRole();
  const { doctors } = useDoctors();
  const { appointments, setAppointments, isLoading, error } = useAppointments();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AppointmentRecord | null>(null);
  const [isUpdating, startUpdateTransition] = useTransition();
  const summary = getAppointmentSummary(appointments);
  const sortedAppointments = [...appointments].sort((left, right) =>
    `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`),
  );
  const canManage = role !== "PATIENT";
  const activeDraftDoctorId = draft?.doctorId ?? "";
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
    setDraft(appointment);
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

  function confirmPayment(appointmentId: string) {
    if (!accessToken) {
      setFeedback("Sign in again to continue.");
      return;
    }

    startUpdateTransition(async () => {
      try {
        const checkoutRes = await fetch("/api/v2/payments/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ appointment_id: appointmentId }),
        });
        if (checkoutRes.ok) {
          const { url } = (await checkoutRes.json()) as { url?: string };
          if (url) {
            window.location.href = url;
            return;
          }
        }
      } catch {
        // Fall back to manual mark-paid flow.
      }

      const result = await markAppointmentPaidAction(accessToken, appointmentId);
      setAppointments(result.appointments);
      setFeedback(result.message);
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-6 shadow-[0_28px_70px_rgba(16,185,129,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Appointments</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live booking overview
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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

      <div className="space-y-4">
        {sortedAppointments.map((appointment) => {
          const doctor = doctors.find((item) => item.id === appointment.doctorId)
            ?? (appointment.doctorId ? getDoctorById(appointment.doctorId) : null);
          const isEditing = editingId === appointment.id && draft !== null;

          return (
            <article key={appointment.id} className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(16,185,129,0.10)]">
              <div className="flex flex-col gap-4 border-b border-emerald-50 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{appointment.patientName}</h2>
                    <Badge tone={appointment.type === "Clinic" ? "emerald" : "sky"}>{appointment.type}</Badge>
                    <Badge tone={appointment.status === "Pending Payment" ? "amber" : "emerald"}>{appointment.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {doctor?.name ?? "Assigned doctor"} | {formatDisplayDate(appointment.date)} | {formatRange(appointment.start, appointment.end)} | Queue #{appointment.queueNumber}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{appointment.reason || "No consultation reason provided."}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {appointment.type === "Online" && appointment.status === "Pending Payment" ? (
                    <button type="button" onClick={() => confirmPayment(appointment.id)} className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700">
                      Continue Payment
                    </button>
                  ) : null}
                  {appointment.meetingLink ? (
                    <a href={appointment.meetingLink} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
                      Open Meeting Link
                    </a>
                  ) : null}
                  {canManage && !isEditing ? (
                    <>
                      <button type="button" onClick={() => beginEdit(appointment)} className="rounded-full border border-emerald-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteAppointment(appointment.id)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50">
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-5 px-5 py-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Patient details</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <input value={draft.patientName} onChange={(event) => updateDraft("patientName", event.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="Patient name" />
                        <input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="Email" />
                        <input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="Phone" />
                        <input value={draft.reason} onChange={(event) => updateDraft("reason", event.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" placeholder="Reason" />
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Schedule setup</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <select value={draft.doctorId} onChange={(event) => updateDraft("doctorId", event.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100">
                          {doctors.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <select value={draft.type} onChange={(event) => updateDraft("type", event.target.value as AppointmentType)} className="w-full rounded-[1.15rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100">
                          <option value="Clinic">Clinic</option>
                          <option value="Online">Online</option>
                        </select>
                        <input type="date" min={today} value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} className="w-full rounded-[1.15rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" />
                        {nextAvailableSlot ? (
                          <button
                            type="button"
                            onClick={() => {
                              updateDraft("date", nextAvailableSlot.date);
                              updateDraft("start", nextAvailableSlot.slot.start);
                              updateDraft("end", nextAvailableSlot.slot.end);
                            }}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Use next available
                          </button>
                        ) : (
                          <div className="rounded-[1.15rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-500">
                            Pick a date to load available times.
                          </div>
                        )}
                      </div>
                      {blockedReason ? (
                        <div className="mt-3 rounded-[1.15rem] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          {blockedReason}
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

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <button type="button" onClick={() => { setEditingId(null); setDraft(null); }} className="rounded-full border border-emerald-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                      Cancel
                    </button>
                    <button type="button" onClick={saveDraft} disabled={isUpdating || !draft.start} className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
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
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    sky: "text-sky-600",
  };
  return (
    <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-[0_16px_34px_rgba(16,185,129,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-[0_22px_40px_rgba(16,185,129,0.12)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-3 text-3xl font-black ${styles[tone]}`}>{value}</p>
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
