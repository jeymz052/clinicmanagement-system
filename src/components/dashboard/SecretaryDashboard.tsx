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
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(135deg,_#f8fffb,_#effcf3_52%,_#dcfce7)] p-6 shadow-[0_28px_70px_rgba(16,185,129,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Secretary Dashboard</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">Welcome, Secretary</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Coordinate bookings, walk-ins, and payment follow-ups from one green workspace.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {todayAppointments.length} appointments today
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Today Appointments" value={todayAppointments.length} />
        <Card label="Legacy Unpaid Online" value={pendingOnline} />
        <Card label="Clinic Billing Queue" value={waitingClinicBilling} />
        <Card label="Total Patients" value={patients.length} />
      </div>

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <h2 className="mb-4 text-base font-bold text-slate-900">Quick Actions</h2>
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
    <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-[0_16px_34px_rgba(16,185,129,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(16,185,129,0.12)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group rounded-[1.2rem] border border-emerald-100 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:scale-[1.02] hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-[0_16px_30px_rgba(16,185,129,0.10)]"
    >
      <span>{label}</span>
    </Link>
  );
}
