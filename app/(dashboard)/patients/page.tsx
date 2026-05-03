"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { FaRegPenToSquare, FaTrashCan } from "react-icons/fa6";
import { usePatients } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { PatientRecordItem } from "@/src/lib/clinic";
import { GENDER_OPTIONS, validatePatientRegistrationFields } from "@/src/lib/patient-registration";

type PatientDraft = PatientRecordItem;
type NewPatientForm = Omit<PatientRecordItem, "id" | "status">;
type PatientFilter = "all" | "registered" | "walk-in";
type StatusFilter = "all" | "Active" | "Inactive";

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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PatientFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const maxBirthDate = new Date().toISOString().slice(0, 10);

  const canManage = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const totalPatients = patients.length;
  const activePatients = patients.filter((patient) => patient.status === "Active").length;
  const walkInPatients = patients.filter((patient) => patient.isWalkIn).length;
  const registeredPatients = totalPatients - walkInPatients;

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return patients.filter((patient) => {
      const matchesSearch =
        !query ||
        patient.fullName.toLowerCase().includes(query) ||
        patient.email.toLowerCase().includes(query) ||
        patient.phone.toLowerCase().includes(query);
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "walk-in" ? patient.isWalkIn : !patient.isWalkIn);
      const matchesStatus = statusFilter === "all" || patient.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [patients, search, statusFilter, typeFilter]);

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
      setFeedback(newPatient.isWalkIn ? "Walk-in patient added successfully." : "Patient added successfully.");
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-6 shadow-[0_28px_70px_rgba(16,185,129,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Patient Management</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Manage registered and walk-in patients</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Search, update, and organize patient records in one place.</p>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href="/patients/add"
                className="rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Walk-In Intake
              </Link>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)]"
              >
                Add Patient
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Patients" value={totalPatients} />
        <MetricCard label="Active" value={activePatients} />
        <MetricCard label="Walk-Ins" value={walkInPatients} />
        <MetricCard label="Registered" value={registeredPatients} />
      </section>

      <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Search patient
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, or phone"
              className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Patient type
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as PatientFilter)}
              className="mt-2 w-full rounded-[1rem] border border-emerald-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="all">All patients</option>
              <option value="registered">Registered only</option>
              <option value="walk-in">Walk-ins only</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="mt-2 w-full rounded-[1rem] border border-emerald-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="all">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </div>
      </section>

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

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-md">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Patient directory</h2>
            <p className="mt-1 text-sm text-slate-500">{filteredPatients.length} patient record(s) match the current filters.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
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
              {filteredPatients.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    No patients matched the current search and filters.
                  </td>
                </tr>
              ) : null}
              {filteredPatients.map((patient) => (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-[0_16px_34px_rgba(16,185,129,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(16,185,129,0.12)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            x
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name">
              <input
                type="text"
                value={patient.fullName}
                onChange={(event) => onChange("fullName", event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={patient.email}
                onChange={(event) => onChange("email", event.target.value)}
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
                onChange={(event) => onChange("phone", event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </Field>
            <Field label="Date of Birth">
              <input
                type="date"
                max={maxBirthDate}
                value={patient.dateOfBirth}
                onChange={(event) => onChange("dateOfBirth", event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Gender">
              <select
                value={patient.gender}
                onChange={(event) => onChange("gender", event.target.value)}
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
                  onChange={(event) => onChange("status", event.target.value)}
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
              onChange={(event) => onChange("address", event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
              required
            />
          </Field>

          {!showStatus ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={patient.isWalkIn}
                onChange={(event) => onChange("isWalkIn", event.target.checked)}
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
