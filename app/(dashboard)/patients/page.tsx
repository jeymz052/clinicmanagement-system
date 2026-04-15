"use client";

import { useState, useTransition } from "react";
import { usePatients } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { PatientRecordItem } from "@/src/lib/clinic";

type PatientDraft = PatientRecordItem;

type NewPatientForm = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  emergencyContact: string;
  isWalkIn: boolean;
};

const EMPTY_NEW_PATIENT: NewPatientForm = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  emergencyContact: "",
  isWalkIn: false,
};

export default function PatientsPage() {
  const { accessToken, role } = useRole();
  const { data: patients, setData: setPatients, isLoading, error } = usePatients();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PatientDraft | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isMutating, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatient, setNewPatient] = useState<NewPatientForm>(EMPTY_NEW_PATIENT);

  const canManage = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";

  function beginEdit(patient: PatientRecordItem) {
    setEditingId(patient.id);
    setDraft(patient);
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
        setFeedback("Unable to update patient.");
        return;
      }

      const payload = (await response.json()) as { data: PatientRecordItem[] };
      setPatients(payload.data);
      setEditingId(null);
      setDraft(null);
      setFeedback("Patient updated.");
    });
  }

  function deletePatient(id: string) {
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
      setFeedback("Patient deleted.");
    });
  }

  function submitNewPatient(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
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
        setFeedback("Unable to add patient.");
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
      <div className="flex items-center justify-between gap-4 animate-fade-in-down">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Patients</h1>
          <p className="mt-1 text-base text-slate-600">Manage patient records, walk-ins, and contact information.</p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-xl bg-teal-700 px-5 py-2.5 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-teal-800 hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-teal-400"
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="animate-fade-in-up stagger-1"><Summary label="Total Patients" value={patients.length.toString()} tone="teal" /></div>
        <div className="animate-fade-in-up stagger-2"><Summary label="Walk-Ins" value={patients.filter((patient) => patient.isWalkIn).length.toString()} tone="amber" /></div>
        <div className="animate-fade-in-up stagger-3"><Summary label="Active" value={patients.filter((patient) => patient.status === "Active").length.toString()} tone="emerald" /></div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md hover-lift animate-fade-in-up stagger-4">
        <table className="w-full text-left text-base">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700">Patient</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Contact</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Details</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  No patients yet. Click &quot;+ Add Patient&quot; to get started.
                </td>
              </tr>
            ) : null}
            {patients.map((patient) => {
              const isEditing = editingId === patient.id && draft !== null;
              return (
                <tr
                  key={patient.id}
                  className="border-t border-slate-200 align-top transition-all duration-150 hover:bg-teal-50/40"
                >
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={draft.fullName}
                          onChange={(event) => updateDraft("fullName", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none ring-teal-400 transition focus:ring shadow-sm"
                        />
                        <input
                          value={draft.dateOfBirth}
                          onChange={(event) => updateDraft("dateOfBirth", event.target.value)}
                          type="date"
                          className="w-full rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none ring-teal-400 transition focus:ring shadow-sm"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-900">{patient.fullName}</p>
                        <p className="mt-1 text-xs text-slate-500">{patient.isWalkIn ? "Walk-in" : "Registered"}</p>
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={draft.email}
                          onChange={(event) => updateDraft("email", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none ring-teal-400 transition focus:ring shadow-sm"
                        />
                        <input
                          value={draft.phone}
                          onChange={(event) => updateDraft("phone", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-slate-900 placeholder:text-slate-500 outline-none ring-teal-400 transition focus:ring shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="text-slate-600">
                        <p>{patient.email}</p>
                        <p className="mt-1 text-xs text-slate-500">{patient.phone}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={draft.gender}
                          onChange={(event) => updateDraft("gender", event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                        <input
                          value={draft.emergencyContact}
                          onChange={(event) => updateDraft("emergencyContact", event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                      </div>
                    ) : (
                      <div className="text-slate-600">
                        <p>{patient.gender}</p>
                        <p className="mt-1 text-xs text-slate-500">{patient.emergencyContact}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          updateDraft("status", event.target.value as PatientRecordItem["status"])
                        }
                        className="rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-slate-900 outline-none ring-teal-400 transition focus:ring shadow-sm"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          patient.status === "Active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {patient.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {canManage && !isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => beginEdit(patient)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePatient(patient.id)}
                            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-700 transition-all duration-150 hover:bg-red-100 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300"
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={savePatient}
                            disabled={isMutating}
                            className="rounded-lg bg-teal-700 px-3 py-1 text-xs font-semibold text-white shadow-md transition-all duration-150 hover:bg-teal-800 hover:scale-105 disabled:bg-teal-300"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setDraft(null);
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-100 hover:border-teal-300 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                          >
                            Cancel
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading patient records...</p> : null}

      {/* Add Patient Modal */}
      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-slate-900">Add New Patient</h2>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setNewPatient(EMPTY_NEW_PATIENT); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={submitNewPatient} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newPatient.fullName}
                    onChange={(e) => setNewPatient((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="Juan Dela Cruz"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newPatient.email}
                    onChange={(e) => setNewPatient((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="juan@email.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="+63 912 345 6789"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={newPatient.dateOfBirth}
                    onChange={(e) => setNewPatient((p) => ({ ...p, dateOfBirth: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient((p) => ({ ...p, gender: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Contact</label>
                  <input
                    type="tel"
                    value={newPatient.emergencyContact}
                    onChange={(e) => setNewPatient((p) => ({ ...p, emergencyContact: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="+63 912 345 6780"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={newPatient.address}
                  onChange={(e) => setNewPatient((p) => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="123 Main Street, City"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isWalkIn"
                  checked={newPatient.isWalkIn}
                  onChange={(e) => setNewPatient((p) => ({ ...p, isWalkIn: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400"
                />
                <label htmlFor="isWalkIn" className="text-sm text-slate-700">Walk-in Patient</label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setNewPatient(EMPTY_NEW_PATIENT); }}
                  className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-teal-300"
                >
                  {isMutating ? "Saving..." : "Save Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Summary({
  label,
  value,
  tone = "teal",
}: {
  label: string;
  value: string;
  tone?: "teal" | "amber" | "emerald";
}) {
  const accent = {
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-md hover-lift">
      <div className={`absolute -top-4 -right-4 h-16 w-16 rounded-full opacity-10 ${accent[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
