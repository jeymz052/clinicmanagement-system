"use client";

import Link from "next/link";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getRoleProfile } from "@/src/lib/roles";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const ROLE_SUMMARIES = {
  SUPER_ADMIN: {
    headline: "Super Admin",
    description: "Full system oversight and configuration.",
    quickLinks: [
      { label: "Appointments", href: "/appointments" },
      { label: "Payments", href: "/payments" },
      { label: "Schedules", href: "/schedules" },
    ],
  },
  SECRETARY: {
    headline: "Secretary",
    description: "Efficiently manage patient flow and billing.",
    quickLinks: [
      { label: "Book Appointment", href: "/appointments" },
      { label: "Appointment List", href: "/appointments/list" },
      { label: "POS Billing", href: "/payments/pos" },
    ],
  },
  DOCTOR: {
    headline: "Doctor",
    description: "View schedules and manage consultations.",
    quickLinks: [
      { label: "Calendar", href: "/appointments/calendar" },
      { label: "My Schedule", href: "/schedules" },
      { label: "Consultations", href: "/consultations" },
    ],
  },
  PATIENT: {
    headline: "Patient",
    description: "Book appointments and track your care.",
    quickLinks: [
      { label: "Book Appointment", href: "/appointments" },
      { label: "Payments", href: "/payments" },
      { label: "My Records", href: "/patients/records" },
    ],
  },
} as const;

export default function Dashboard() {
  const { role } = useRole();
  const profile = getRoleProfile(role);
  const summary = ROLE_SUMMARIES[role];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-md flex flex-col items-start gap-2 animate-fade-in">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Active Role</span>
        <h1 className="text-2xl font-bold text-slate-900">{summary.headline}</h1>
        <p className="text-base text-slate-600">{summary.description}</p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md transition-transform duration-200 hover:scale-[1.025] hover:shadow-lg animate-fade-in">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Links</h2>
          <div className="space-y-3">
            {summary.quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-base font-medium text-slate-700 transition-all duration-200 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800 hover:scale-[1.03] group"
              >
                <span className="transition-colors duration-200 group-hover:text-teal-700">{link.label}</span>
                <span className="text-xs uppercase tracking-[0.14em] text-slate-400 group-hover:text-teal-600">Open</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md transition-transform duration-200 hover:scale-[1.025] hover:shadow-lg animate-fade-in">
          <h2 className="text-lg font-bold text-slate-900 mb-4">System Metrics</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MetricCard label="Appointment Rules" value="Shared Slot" note="Clinic and online cannot overlap" />
            <MetricCard label="Capacity" value="5 / Hour" note="Per doctor, queue auto-assigned" />
            <MetricCard label="Clinic Payment" value="POS Later" note="No upfront payment required" />
            <MetricCard label="Online Payment" value="Payment First" note="Meeting link created after payment" />
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-md mt-8 animate-fade-in">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Patient Statistics</h2>
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={patientStatsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 13, fill: '#64748b' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Patient" fill="#14b8a6" radius={[8, 8, 0, 0]} barSize={32} />
              <Bar dataKey="Inpatient" fill="#fbbf24" radius={[8, 8, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-md mt-8 animate-fade-in">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Appointment Trends</h2>
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={appointmentTrendsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 13, fill: '#64748b' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Appointments" fill="#14b8a6" radius={[8, 8, 0, 0]} barSize={32} />
              <Bar dataKey="Online" fill="#38bdf8" radius={[8, 8, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-md mt-8 animate-fade-in">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="px-4 py-3 font-semibold">No</th>
                <th className="px-4 py-3 font-semibold">Patient Name</th>
                <th className="px-4 py-3 font-semibold">Age</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-teal-50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{item.id}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">{item.patient}</td>
                  <td className="px-4 py-2 text-slate-700">{item.age}</td>
                  <td className="px-4 py-2 text-slate-700">{item.date}</td>
                  <td className="px-4 py-2 text-slate-700">{item.time}</td>
                  <td className="px-4 py-2 text-slate-700">{item.type}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.status === "Completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.status === "Paid"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-all duration-200 hover:bg-teal-50 hover:border-teal-300 hover:scale-[1.03] animate-fade-in">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    <p className="mt-2 text-sm text-slate-500">{note}</p>
  </article>
  );
}

const patientStatsData = [
  { day: "Mon", Patient: 950, Inpatient: 480 },
  { day: "Tue", Patient: 792, Inpatient: 493 },
  { day: "Wed", Patient: 501, Inpatient: 150 },
  { day: "Thu", Patient: 800, Inpatient: 523 },
  { day: "Fri", Patient: 500, Inpatient: 150 },
  { day: "Sat", Patient: 280, Inpatient: 0 },
  { day: "Sun", Patient: 0, Inpatient: 0 },
];

const appointmentTrendsData = [
  { day: "Mon", Appointments: 40, Online: 18 },
  { day: "Tue", Appointments: 32, Online: 12 },
  { day: "Wed", Appointments: 28, Online: 10 },
  { day: "Thu", Appointments: 45, Online: 20 },
  { day: "Fri", Appointments: 38, Online: 15 },
  { day: "Sat", Appointments: 20, Online: 7 },
  { day: "Sun", Appointments: 10, Online: 2 },
];

const recentActivity = [
  { id: "01", patient: "Isagi Yoichi", age: 20, date: "25 Dec 2023", time: "08:30 pm", type: "FUP+ECG", status: "Pending" },
  { id: "02", patient: "Bachira Meguru", age: 22, date: "25 Dec 2023", time: "09:00 am", type: "Consultation", status: "Completed" },
  { id: "03", patient: "Nagi Seishiro", age: 19, date: "24 Dec 2023", time: "10:00 am", type: "FUP", status: "Paid" },
];
