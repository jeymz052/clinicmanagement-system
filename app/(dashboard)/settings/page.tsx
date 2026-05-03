"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { SystemSettings } from "@/src/lib/clinic";

const EMPTY: SystemSettings = {
  clinicName: "",
  email: "",
  phone: "",
  address: "",
  onlineConsultationFee: 0,
  maxPatientsPerHour: 5,
  clinicOpenTime: "08:00",
  clinicCloseTime: "17:00",
};

export default function SettingsPage() {
  const { role, accessToken, isLoading: authLoading } = useRole();
  const [settings, setSettings] = useState<SystemSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSaving, startTransition] = useTransition();

  const canEdit = role === "SUPER_ADMIN" || role === "DOCTOR";

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/settings", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load settings");
        const payload = (await res.json()) as { data: SystemSettings };
        if (active) setSettings(payload.data);
      } catch (e) {
        if (active) setFeedback({ message: e instanceof Error ? e.message : "Failed to load settings", type: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  function updateField<K extends keyof SystemSettings>(field: K, value: SystemSettings[K]) {
    setSettings((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    startTransition(async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        setFeedback({ message: "Failed to save settings.", type: "error" });
        return;
      }
      const payload = (await res.json()) as { data: SystemSettings };
      setSettings(payload.data);
      setFeedback({ message: "Settings saved.", type: "success" });
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,#f8fffb_0%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(16,185,129,0.10)] animate-fade-in-down">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Settings</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Manage clinic details and hours</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Update the clinic profile, hours, and consultation fee settings.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Shortcut href="/schedules" label="Schedules" />
            <Shortcut href="/pricing" label="Pricing" />
            <Shortcut href="/payments" label="Payments" />
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Read-only view. Only Super Admin and Doctor can modify system settings.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-emerald-100 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-1">
        <h2 className="text-lg font-bold text-slate-900">General</h2>
        <fieldset disabled={loading || !canEdit || isSaving} className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">Clinic Name</label>
            <input
              type="text"
              value={settings.clinicName}
              onChange={(e) => updateField("clinicName", e.target.value)}
              className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-3 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-3 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-3 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Address</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-3 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Clinic Opens</label>
              <input
                type="time"
                value={settings.clinicOpenTime}
                onChange={(e) => updateField("clinicOpenTime", e.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-3 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Clinic Closes</label>
              <input
                type="time"
                value={settings.clinicCloseTime}
                onChange={(e) => updateField("clinicCloseTime", e.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-3 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Online Consultation Fee</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={settings.onlineConsultationFee}
                onChange={(e) => updateField("onlineConsultationFee", Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Max Patients per Hour</label>
              <input
                type="number"
                min={1}
                max={20}
                value={settings.maxPatientsPerHour}
                onChange={(e) => updateField("maxPatientsPerHour", Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {canEdit ? (
            <button
              type="submit"
              disabled={isSaving || loading}
              className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-6 py-3 font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          ) : null}
        </fieldset>
      </form>
    </div>
  );
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
