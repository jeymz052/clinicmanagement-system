"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { usePatients } from "@/src/components/clinic/useClinicData";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function SecretaryDashboard() {
  const { appointments } = useAppointments();
  const { data: patients } = usePatients();
  const today = todayIso();

  const todayAppointments = useMemo(
    () => appointments.filter((a) => a.date === today),
    [appointments, today],
  );
  const pendingOnline = useMemo(
    () =>
      appointments.filter(
        (a) => a.type === "Online" && a.status === "Pending Payment",
      ).length,
    [appointments],
  );
  const waitingClinicBilling = useMemo(
    () =>
      appointments.filter((a) => a.type === "Clinic" && a.status === "Completed")
        .length,
    [appointments],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, Secretary</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage bookings, patient flow, and POS operations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Today Appointments" value={todayAppointments.length} />
        <Card label="Pending Online Payment" value={pendingOnline} />
        <Card label="Clinic Billing Queue" value={waitingClinicBilling} />
        <Card label="Total Patients" value={patients.length} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/appointments" label="Book Appointment" />
          <QuickAction href="/appointments/list" label="Manage Appointments" />
          <QuickAction href="/patients/add" label="Add Walk-In Patient" />
          <QuickAction href="/payments/pos" label="POS Billing" />
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      {label}
    </Link>
  );
}
