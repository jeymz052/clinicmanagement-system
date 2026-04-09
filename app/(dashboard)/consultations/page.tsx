"use client";

import { useState } from "react";

export default function OnlineConsultationPage() {
  const [formData, setFormData] = useState({
    patientName: "",
    email: "",
    reason: "",
    doctor: "",
    date: "",
    time: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Online Consultation</h1>
        <p className="mt-1 text-sm text-slate-500">Schedule a video consultation with a doctor (Payment required)</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Active Consultations</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">8</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Completed</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">42</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Pending Payment</p>
          <p className="mt-2 text-3xl font-bold text-yellow-600">3</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-bold text-slate-900">Book Online Consultation</h2>
        <form className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Patient Name</label>
              <input
                type="text"
                name="patientName"
                value={formData.patientName}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Select Doctor</label>
            <select
              name="doctor"
              value={formData.doctor}
              onChange={handleChange}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Choose a doctor</option>
              <option value="Dr. Lina Fox">Dr. Lina Fox - Cardiology</option>
              <option value="Dr. Omar Reed">Dr. Omar Reed - Neurology</option>
              <option value="Dr. Amara Singh">Dr. Amara Singh - Orthopedics</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Time</label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Reason for Consultation</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Describe your symptoms or concern..."
            />
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-yellow-900">⚠️ Important</p>
            <p className="mt-1 text-sm text-yellow-800">
              Online consultation fee: $50. Payment must be completed before the consultation.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              className="rounded-lg bg-teal-700 px-6 py-2 font-semibold text-white hover:bg-teal-800"
            >
              Proceed to Payment
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-6 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
