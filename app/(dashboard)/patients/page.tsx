"use client";

import { useState } from "react";

const PATIENT_LIST = [
  {
    id: 1,
    name: "Liam Carter",
    age: 45,
    lastVisit: "07 Nov 2025",
    condition: "Statin therapy",
    status: "Active",
  },
  {
    id: 2,
    name: "Ava Mitchell",
    age: 20,
    lastVisit: "06 Nov 2025",
    condition: "Angioplasty",
    status: "Inactive",
  },
  {
    id: 3,
    name: "Noah Patel",
    age: 30,
    lastVisit: "04 Nov 2025",
    condition: "Muscle weakness",
    status: "Active",
  },
  {
    id: 4,
    name: "Sophia Reyes",
    age: 18,
    lastVisit: "04 Nov 2025",
    condition: "Decreased Brain",
    status: "Active",
  },
  {
    id: 5,
    name: "Ethan Hunt",
    age: 25,
    lastVisit: "09 Nov 2025",
    condition: "Partial Paralysis",
    status: "Active",
  },
];

export default function PatientsPage() {
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");

  const filteredPatients = PATIENT_LIST.filter((patient) =>
    patient.name.toLowerCase().includes("")
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Patient Records</h1>
          <p className="mt-1 text-sm text-slate-500">Comprehensive Patient Records View</p>
        </div>
        <button className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800">
          Add New Patient
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option>All Departments</option>
              <option>Cardiology</option>
              <option>Neurology</option>
              <option>Orthopedics</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Date Range</label>
            <input
              type="text"
              placeholder="Oct 1 - Oct 31, 2025"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-700">Patient Name</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Age</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Last Visit</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Condition</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((patient) => (
              <tr key={patient.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">{patient.name}</td>
                <td className="px-6 py-3 text-slate-600">{patient.age}</td>
                <td className="px-6 py-3 text-slate-600">{patient.lastVisit}</td>
                <td className="px-6 py-3 text-slate-600">{patient.condition}</td>
                <td className="px-6 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      patient.status === "Active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {patient.status}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Quick View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
