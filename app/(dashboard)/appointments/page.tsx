"use client";

import Link from "next/link";
import { useEffect } from "react";
import AppointmentListPage from "@/src/components/appointments/AppointmentListPage";
import BookAppointmentPage from "@/src/components/appointments/BookAppointmentPage";
import { useRole } from "@/src/components/layout/RoleProvider";

export default function AppointmentsPage() {
  const { role, isLoading } = useRole();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reservation_paid")) {
        localStorage.removeItem("bookingDraft");
        localStorage.removeItem("bookingReservation");
      }
    } catch {
      // ignore
    }
  }, []);

  if (isLoading) {
    return <div className="h-40 rounded-[2rem] border border-emerald-100 bg-white animate-pulse shadow-sm" />;
  }

  if (role === "DOCTOR") {
    return (
      <div className="space-y-6 pb-8">
        <section className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,#f8fffb_0%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(16,185,129,0.10)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Appointments</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Manage bookings with less friction</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Review bookings, work through the queue, and move directly into consultation when you are ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Shortcut href="/consultations" label="Consultations" />
              <Shortcut href="/consultations/history" label="History" />
              <Shortcut href="/schedules" label="Schedule" />
            </div>
          </div>
        </section>

        <AppointmentListPage />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,#f8fffb_0%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(16,185,129,0.10)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Appointments</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Book and manage visits in one place</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A calmer booking flow for patients and front-desk staff, with shortcuts to payments and records.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Shortcut href="/appointments/my" label="My Appointments" />
            <Shortcut href="/patients/records" label="Patient Records" />
            <Shortcut href="/payments" label="Payments" />
          </div>
        </div>
      </section>

      <BookAppointmentPage />
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-emerald-100 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
    >
      {label}
    </Link>
  );
}
