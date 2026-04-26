"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";

type DoctorOption = {
  id: string;
  specialty: string;
  profiles?: {
    full_name?: string;
  }[];
};

type ScheduleMode = "Clinic" | "Online" | "Both";

type DoctorSchedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  schedule_mode: ScheduleMode;
  is_active: boolean;
};

type ScheduleForm = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  schedule_mode: ScheduleMode;
  is_active: boolean;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const INITIAL_FORM: ScheduleForm = {
  day_of_week: 1,
  start_time: "08:00",
  end_time: "17:00",
  slot_minutes: 60,
  schedule_mode: "Both",
  is_active: true,
};

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function formatMode(mode: ScheduleMode) {
  return mode === "Both" ? "Clinic + Online" : mode;
}

export default function SchedulesPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [form, setForm] = useState<ScheduleForm>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isSaving, startTransition] = useTransition();

  const canManage = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v2/doctors", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load doctors.");
        const payload = (await res.json()) as { doctors: DoctorOption[] };
        if (!active) return;
        setDoctors(payload.doctors ?? []);
        setSelectedDoctorId((current) => current || payload.doctors?.[0]?.id || "");
      } catch (error) {
        if (active) {
          setFeedback({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to load doctors.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  useEffect(() => {
    if (!accessToken || !selectedDoctorId) return;
    let active = true;

    (async () => {
      try {
        setScheduleLoading(true);
        const res = await fetch(`/api/v2/doctors/${selectedDoctorId}/schedule`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load schedules.");
        const payload = (await res.json()) as { schedules: DoctorSchedule[] };
        if (!active) return;
        setSchedules(payload.schedules ?? []);
      } catch (error) {
        if (active) {
          setFeedback({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to load schedules.",
          });
        }
      } finally {
        if (active) setScheduleLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, selectedDoctorId]);

  const scheduleByDay = useMemo(
    () => new Map(schedules.map((item) => [item.day_of_week, item])),
    [schedules],
  );

  function updateField<K extends keyof ScheduleForm>(field: K, value: ScheduleForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingId(null);
  }

  function beginEdit(schedule: DoctorSchedule) {
    setEditingId(schedule.id);
    setForm({
      day_of_week: schedule.day_of_week,
      start_time: normalizeTime(schedule.start_time),
      end_time: normalizeTime(schedule.end_time),
      slot_minutes: schedule.slot_minutes,
      schedule_mode: schedule.schedule_mode,
      is_active: schedule.is_active,
    });
    setFeedback(null);
  }

  function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !selectedDoctorId) return;

    startTransition(async () => {
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(`/api/v2/doctors/${selectedDoctorId}/schedule`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          schedule_id: editingId ?? undefined,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
          slot_minutes: form.slot_minutes,
          schedule_mode: form.schedule_mode,
          is_active: form.is_active,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        schedule?: DoctorSchedule;
      };
      if (!res.ok || !body.schedule) {
        setFeedback({ tone: "error", message: body.message ?? "Failed to save schedule." });
        return;
      }

      const savedSchedule = body.schedule;
      setSchedules((current) => {
        const withoutDay = current.filter((item) => item.day_of_week !== savedSchedule.day_of_week);
        return [...withoutDay, savedSchedule].sort((left, right) => left.day_of_week - right.day_of_week);
      });
      setFeedback({
        tone: "success",
        message: editingId ? "Schedule updated." : "Schedule saved.",
      });
      resetForm();
    });
  }

  function deleteSchedule(schedule: DoctorSchedule) {
    if (!accessToken || !selectedDoctorId) return;

    startTransition(async () => {
      const res = await fetch(
        `/api/v2/doctors/${selectedDoctorId}/schedule?schedule_id=${schedule.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setFeedback({ tone: "error", message: body.message ?? "Failed to delete schedule." });
        return;
      }

      setSchedules((current) => current.filter((item) => item.id !== schedule.id));
      setFeedback({ tone: "success", message: "Schedule deleted." });
      if (editingId === schedule.id) resetForm();
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.18),transparent_32%),linear-gradient(135deg,#ecfdf5_0%,#ffffff_72%)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Schedule Management</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Working hours, schedule CRUD, and clinic coverage</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Add, edit, and delete doctor schedules, set working hours per weekday, and pair them with blocked dates from the unavailable dates module.
        </p>
      </section>

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <RuleCard title="Full CRUD" description="One weekly schedule per doctor/day can be created, edited, toggled active, or removed." />
        <RuleCard title="Working Hours" description="Set start time, end time, slot duration, and whether the shift is clinic-only, online-only, or shared." />
        <RuleCard title="Blocked Dates" description="Use the Unavailable Dates page for leave and no-booking dates. Those blocks continue to override these weekly hours." />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Editor</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Weekly working schedule</h2>
            </div>
            {!canManage ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">View only</span>
            ) : null}
          </div>

          <form className="mt-6 space-y-5" onSubmit={saveSchedule}>
            <Field label="Doctor">
              <select
                value={selectedDoctorId}
                onChange={(event) => setSelectedDoctorId(event.target.value)}
                disabled={loading || !canManage}
                className="mt-2 w-full rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
              >
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {(doctor.profiles?.[0]?.full_name ?? "Assigned doctor")} - {doctor.specialty}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Weekday">
                <select
                  value={form.day_of_week}
                  onChange={(event) => updateField("day_of_week", Number(event.target.value))}
                  disabled={!canManage || isSaving}
                  className="mt-2 w-full rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                >
                  {DAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Schedule Mode">
                <select
                  value={form.schedule_mode}
                  onChange={(event) => updateField("schedule_mode", event.target.value as ScheduleMode)}
                  disabled={!canManage || isSaving}
                  className="mt-2 w-full rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                >
                  <option value="Both">Clinic + Online</option>
                  <option value="Clinic">Clinic only</option>
                  <option value="Online">Online only</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Start Time">
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(event) => updateField("start_time", event.target.value)}
                  disabled={!canManage || isSaving}
                  className="mt-2 w-full rounded-[1.15rem] border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                />
              </Field>

              <Field label="End Time">
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(event) => updateField("end_time", event.target.value)}
                  disabled={!canManage || isSaving}
                  className="mt-2 w-full rounded-[1.15rem] border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                />
              </Field>

              <Field label="Slot Minutes">
                <select
                  value={form.slot_minutes}
                  onChange={(event) => updateField("slot_minutes", Number(event.target.value))}
                  disabled={!canManage || isSaving}
                  className="mt-2 w-full rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                >
                  {[30, 45, 60, 90, 120].map((value) => (
                    <option key={value} value={value}>
                      {value} min
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <label className="flex items-center gap-3 rounded-[1.25rem] border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => updateField("is_active", event.target.checked)}
                disabled={!canManage || isSaving}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Keep this weekday active for booking
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canManage || isSaving || !selectedDoctorId}
                className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : editingId ? "Update Schedule" : "Save Schedule"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Coverage Board</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  {selectedDoctor?.profiles?.[0]?.full_name ?? "Doctor"} weekly coverage
                </h2>
              </div>
              {scheduleLoading ? <span className="text-sm text-slate-500">Refreshing...</span> : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {DAYS.map((day, index) => {
                const schedule = scheduleByDay.get(index) ?? null;
                return (
                  <div key={day} className="rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{day}</p>
                        {schedule ? (
                          <>
                            <p className="mt-2 text-sm text-slate-700">
                              {normalizeTime(schedule.start_time)} - {normalizeTime(schedule.end_time)}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatMode(schedule.schedule_mode)} | {schedule.slot_minutes} min slots
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">No schedule saved.</p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          schedule?.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : schedule
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {schedule ? (schedule.is_active ? "Active" : "Inactive") : "Off"}
                      </span>
                    </div>

                    {schedule && canManage ? (
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => beginEdit(schedule)}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSchedule(schedule)}
                          className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Next Step</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Block leave and unavailable dates</h2>
            <p className="mt-2 text-sm text-slate-600">
              Weekly hours define when a doctor usually works. One-off leave, holidays, and unavailable dates should still be set on the Time Slots / Unavailable Dates page.
            </p>
            <a
              href="/schedules/slots"
              className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              Manage Unavailable Dates
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

function RuleCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/60 px-5 py-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}
