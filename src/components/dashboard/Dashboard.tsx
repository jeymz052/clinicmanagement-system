"use client";

import Link from "next/link";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getRoleProfile } from "@/src/lib/roles";

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
