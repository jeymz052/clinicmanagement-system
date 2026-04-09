"use client";

import { useState } from "react";

export default function BookAppointmentPage() {
  const [formData, setFormData] = useState({
    patientName: "",
    email: "",
    phone: "",
    doctor: "",
    date: "",
    time: "",
    type: "Clinic",
    reason: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Appointment booked successfully!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Book Appointment</h1>
        <p className="mt-1 text-sm text-slate-500">Schedule a new appointment with a doctor</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Appointments</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">42</p>
          <p className="mt-1 text-xs text-emerald-600">↑ 12% vs last week</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Clinic Appointments</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">28</p>
          <p className="mt-1 text-xs text-slate-500">No payment required</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Online Consultations</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">14</p>
          <p className="mt-1 text-xs text-slate-500">Payment required first</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
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
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Select Doctor</label>
              <select
                name="doctor"
                value={formData.doctor}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Choose a doctor</option>
                <option value="Dr. Lina Fox">Dr. Lina Fox</option>
                <option value="Dr. Omar Reed">Dr. Omar Reed</option>
                <option value="Dr. Amara Singh">Dr. Amara Singh</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="john@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="+1 (555) 000-0000"
                required
              />
            </div>
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
                required
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
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Appointment Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="Clinic">Clinic Appointment (No payment)</option>
              <option value="Online">Online Consultation (Payment Required)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Reason for Visit</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Describe your symptoms or reason for visit..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-6 py-2 font-semibold text-white hover:bg-teal-800"
            >
              Reserve Slot
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
