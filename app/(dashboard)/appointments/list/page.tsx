"use client";

import AppointmentListPage from "@/src/components/appointments/AppointmentListPage";
import MyAppointmentsPage from "@/src/components/appointments/MyAppointmentsPage";
import { useRole } from "@/src/components/layout/RoleProvider";

export default function AppointmentListRoute() {
  const { role, isLoading } = useRole();

  if (isLoading) {
    return <div className="h-40 rounded-3xl bg-slate-100 animate-pulse" />;
  }

  if (role === "PATIENT") {
    return (
      <MyAppointmentsPage
        title="My Appointments"
        description="View your booked consultations, payment status, and online meeting access."
      />
    );
  }

  return <AppointmentListPage />;
}
