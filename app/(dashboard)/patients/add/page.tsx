"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { PatientRecordItem } from "@/src/lib/clinic";
import { GENDER_OPTIONS, validatePatientRegistrationFields } from "@/src/lib/patient-registration";

type WalkInForm = Omit<PatientRecordItem, "id" | "status">;

const INITIAL_FORM: WalkInForm = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  isWalkIn: true,
};

export default function AddPatientPage() {
  const router = useRouter();
  const { accessToken, role } = useRole();
  const [form, setForm] = useState<WalkInForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [isSubmitting, startTransition] = useTransition();
  const maxBirthDate = new Date().toISOString().slice(0, 10);

  const canManage = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";

  function updateField<K extends keyof WalkInForm>(field: K, value: WalkInForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setFeedback({ message: "Your session expired. Please sign in again.", tone: "error" });
      return;
    }

    const validationError = validatePatientRegistrationFields(form);
    if (validationError) {
      setFeedback({ message: validationError, tone: "error" });
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setFeedback({ message: body?.message ?? "Unable to save walk-in patient.", tone: "error" });
        return;
      }

      setFeedback({ message: "Walk-in patient added successfully. Redirecting to the patient list...", tone: "success" });
      setTimeout(() => router.push("/patients"), 700);
    });
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        Only clinic staff can add walk-in patients.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-6 shadow-[0_28px_70px_rgba(16,185,129,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Walk-In Intake</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Add a walk-in patient quickly</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Enter the patient details below to create a new walk-in record.</p>
          </div>

          <Link
            href="/patients"
            className="rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            Back to Patients
          </Link>
        </div>
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

      <div>
        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Full Name">
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                placeholder="Juan Dela Cruz"
                required
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                placeholder="juan@example.com"
                required
              />
            </Field>

            <Field label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                placeholder="+63 912 345 6789"
                required
              />
            </Field>

            <Field label="Date of Birth">
              <input
                type="date"
                max={maxBirthDate}
                value={form.dateOfBirth}
                onChange={(event) => updateField("dateOfBirth", event.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                required
              />
            </Field>

            <Field label="Gender">
              <select
                value={form.gender}
                onChange={(event) => updateField("gender", event.target.value)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                required
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Patient Type">
              <div className="mt-2 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                Walk-in patient
              </div>
            </Field>
          </div>

          <Field label="Address">
            <input
              type="text"
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              placeholder="Street, barangay, city"
              required
            />
          </Field>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save Walk-In Patient"}
            </button>
            <Link
              href="/patients"
              className="rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
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

