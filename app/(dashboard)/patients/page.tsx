"use client";

import { useState, useTransition } from "react";
import { FaRegPenToSquare, FaTrashCan } from "react-icons/fa6";
import { usePatients } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { PatientRecordItem } from "@/src/lib/clinic";
import { GENDER_OPTIONS, validatePatientRegistrationFields } from "@/src/lib/patient-registration";

type PatientDraft = PatientRecordItem;
type NewPatientForm = Omit<PatientRecordItem, "id" | "status">;

const EMPTY_NEW_PATIENT: NewPatientForm = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  isWalkIn: false,
};

export default function PatientsPage() {
  const { accessToken, role } = useRole();
  const { data: patients, setData: setPatients, isLoading, error } = usePatients();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isMutating, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newPatient, setNewPatient] = useState<NewPatientForm>(EMPTY_NEW_PATIENT);
  const [draft, setDraft] = useState<PatientDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientRecordItem | null>(null);
  const maxBirthDate = new Date().toISOString().slice(0, 10);

  const canManage = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";

  function beginEdit(patient: PatientRecordItem) {
    setDraft(patient);
    setShowEditModal(true);
    setFeedback(null);
  }

  function updateDraft<K extends keyof PatientDraft>(field: K, value: PatientDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function savePatient() {
    if (!accessToken || !draft) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    const validationError = validatePatientRegistrationFields(draft);
    if (validationError) {
      setFeedback(validationError);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/patients", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setFeedback(body?.message ?? "Unable to update patient.");
        return;
      }

      const payload = (await response.json()) as { data: PatientRecordItem[] };
      setPatients(payload.data);
      setDraft(null);
      setShowEditModal(false);
      setFeedback("Patient updated.");
    });
  }

  function confirmDelete(id: string) {
    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/patients?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        setFeedback("Unable to delete patient.");
        return;
      }

      const payload = (await response.json()) as { data: PatientRecordItem[] };
      setPatients(payload.data);
      setDeleteTarget(null);
      setFeedback("Patient deleted.");
    });
  }

  function submitNewPatient(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    const validationError = validatePatientRegistrationFields(newPatient);
    if (validationError) {
      setFeedback(validationError);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(newPatient),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setFeedback(body?.message ?? "Unable to add patient.");
        return;
      }

      const payload = (await response.json()) as { data: PatientRecordItem[] };
      setPatients(payload.data);
      setNewPatient(EMPTY_NEW_PATIENT);
      setShowAddModal(false);
      setFeedback("Patient added successfully.");
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Patients</h1>
          <p className="mt-1 text-base text-slate-600">Manage patient records and status.</p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-xl bg-teal-700 px-5 py-2.5 text-base font-semibold text-white shadow-md transition hover:bg-teal-800"
          >
            + Add Patient
          </button>
        ) : null}
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

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Full Name</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Phone</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Date of Birth</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Gender</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Address</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  No patients yet. Click &quot;+ Add Patient&quot; to get started.
                </td>
              </tr>
            ) : null}
            {patients.map((patient) => (
              <tr key={patient.id} className="border-t border-slate-200 align-top hover:bg-teal-50/30">
                <td className="px-4 py-3 text-slate-900">{patient.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{patient.email}</td>
                <td className="px-4 py-3 text-slate-600">{patient.phone || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{patient.dateOfBirth || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{patient.gender || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{patient.address || "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      patient.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {patient.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{patient.isWalkIn ? "Walk-in" : "Registered"}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(patient)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                        aria-label={`Edit ${patient.fullName}`}
                      >
                        <FaRegPenToSquare className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(patient)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:border-red-400 hover:bg-red-100"
                        aria-label={`Delete ${patient.fullName}`}
                      >
                        <FaTrashCan className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading patient records...</p> : null}

      {showAddModal ? (
        <PatientFormModal
          title="Add New Patient"
          confirmLabel={isMutating ? "Saving..." : "Save Patient"}
          patient={newPatient}
          maxBirthDate={maxBirthDate}
          onClose={() => {
            setShowAddModal(false);
            setNewPatient(EMPTY_NEW_PATIENT);
          }}
          onChange={(field, value) => setNewPatient((current) => ({ ...current, [field]: value }))}
          onSubmit={submitNewPatient}
          isMutating={isMutating}
        />
      ) : null}

      {showEditModal && draft ? (
        <PatientFormModal
          title="Edit Patient"
          confirmLabel={isMutating ? "Saving..." : "Save Changes"}
          patient={draft}
          maxBirthDate={maxBirthDate}
          onClose={() => {
            setShowEditModal(false);
            setDraft(null);
          }}
          onChange={(field, value) => updateDraft(field, value as never)}
          onSubmit={(event) => {
            event.preventDefault();
            savePatient();
          }}
          isMutating={isMutating}
          showStatus
        />
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Delete patient record?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will set <span className="font-semibold">{deleteTarget.fullName}</span> as inactive.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deleteTarget.id)}
                disabled={isMutating}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
              >
                {isMutating ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type PatientFormModalProps = {
  title: string;
  confirmLabel: string;
  patient: NewPatientForm | PatientDraft;
  maxBirthDate: string;
  onClose: () => void;
  onChange: (field: keyof PatientDraft, value: string | boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
  isMutating: boolean;
  showStatus?: boolean;
};

function PatientFormModal({
  title,
  confirmLabel,
  patient,
  maxBirthDate,
  onClose,
  onChange,
  onSubmit,
  isMutating,
  showStatus = false,
}: PatientFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name">
              <input
                type="text"
                value={patient.fullName}
                onChange={(e) => onChange("fullName", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={patient.email}
                onChange={(e) => onChange("email", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input
                type="tel"
                value={patient.phone}
                onChange={(e) => onChange("phone", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </Field>
            <Field label="Date of Birth">
              <input
                type="date"
                max={maxBirthDate}
                value={patient.dateOfBirth}
                onChange={(e) => onChange("dateOfBirth", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Gender">
              <select
                value={patient.gender}
                onChange={(e) => onChange("gender", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                required
              >
                <option value="">Select Gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            {showStatus ? (
              <Field label="Status">
                <select
                  value={(patient as PatientDraft).status}
                  onChange={(e) => onChange("status", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </Field>
            ) : (
              <div />
            )}
          </div>

          <Field label="Address">
            <input
              type="text"
              value={patient.address}
              onChange={(e) => onChange("address", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
              required
            />
          </Field>

          {!showStatus ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={patient.isWalkIn}
                onChange={(e) => onChange("isWalkIn", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400"
              />
              Walk-in Patient
            </label>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-teal-300"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
