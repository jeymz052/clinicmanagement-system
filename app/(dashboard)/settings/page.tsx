"use client";

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
};

export default function SettingsPage() {
  const { role, accessToken, isLoading: authLoading } = useRole();
  const [settings, setSettings] = useState<SystemSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSaving, startTransition] = useTransition();

  const canEdit = role === "SUPER_ADMIN";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">System and clinic-wide configuration</p>
      </div>

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
          Read-only view. Only Super Admin can modify system settings.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-bold text-slate-900">General</h2>
        <fieldset disabled={loading || !canEdit || isSaving} className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">Clinic Name</label>
            <input
              type="text"
              value={settings.clinicName}
              onChange={(e) => updateField("clinicName", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Address</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
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
              <p className="mt-1 text-xs text-slate-500">
                Note: This is a display value. Enforcement is fixed at 5 via the database uniqueness constraint.
              </p>
            </div>
          </div>

          {canEdit ? (
            <button
              type="submit"
              disabled={isSaving || loading}
              className="rounded-lg bg-teal-700 px-6 py-2 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          ) : null}
        </fieldset>
      </form>
    </div>
  );
}
