"use client";

export default function PatientRecordsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Medical Records</h1>
        <p className="mt-1 text-sm text-slate-500">View and manage patient medical history</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Patient Search</p>
          <input
            type="text"
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Search by patient name or ID"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Record Type</p>
          <select className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option>All Records</option>
            <option>Diagnosis</option>
            <option>Lab Results</option>
            <option>Prescription</option>
          </select>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Date Range</p>
          <input
            type="date"
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-bold text-slate-900">Patient Timeline</h2>
        <div className="mt-6 space-y-4">
          <div className="border-l-4 border-red-600 bg-red-50 p-4 pl-4">
            <p className="font-semibold text-slate-900">Diagnosis Updated</p>
            <p className="mt-1 text-sm text-slate-600">Hypertension - Stage 2 | 15 Nov 2025</p>
          </div>
          <div className="border-l-4 border-emerald-600 bg-emerald-50 p-4 pl-4">
            <p className="font-semibold text-slate-900">Lab Results Received</p>
            <p className="mt-1 text-sm text-slate-600">Blood Work - Normal | 12 Nov 2025</p>
          </div>
          <div className="border-l-4 border-blue-600 bg-blue-50 p-4 pl-4">
            <p className="font-semibold text-slate-900">Prescription Issued</p>
            <p className="mt-1 text-sm text-slate-600">Lisinopril 10mg - Daily | 10 Nov 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
}
