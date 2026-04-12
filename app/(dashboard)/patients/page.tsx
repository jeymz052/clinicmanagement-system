"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePatients } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { PatientRecordItem } from "@/src/lib/clinic";

type PatientDraft = PatientRecordItem;

export default function PatientsPage() {
  const { accessToken, role } = useRole();
  const { data: patients, setData: setPatients, isLoading, error } = usePatients();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PatientDraft | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isMutating, startTransition] = useTransition();

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Patients</h1>
          <p className="mt-1 text-base text-slate-600">Manage patient records, walk-ins, and contact information.</p>
        </div>
        {canManage ? (
          <Link
            href="/patients/add"
            className="rounded-xl bg-teal-700 px-5 py-2.5 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-teal-800 hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            Add Walk-In / Patient
          </Link>
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
        <Summary label="Total Patients" value={patients.length.toString()} />
        <Summary label="Walk-Ins" value={patients.filter((patient) => patient.isWalkIn).length.toString()} />
        <Summary label="Active" value={patients.filter((patient) => patient.status === "Active").length.toString()} />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
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
                      <Link
                        href="/patients/records"
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      >
                        Records
                      </Link>
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
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md transition-all duration-200 hover:bg-teal-50 hover:border-teal-300 hover:scale-[1.04] animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
