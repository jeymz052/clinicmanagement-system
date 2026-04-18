"use client";

import AppointmentListPage from "@/src/components/appointments/AppointmentListPage";
import BookAppointmentPage from "@/src/components/appointments/BookAppointmentPage";
import { useRole } from "@/src/components/layout/RoleProvider";

export default function AppointmentsPage() {
  const { role, isLoading } = useRole();

  if (isLoading) {
    return <div className="h-40 rounded-3xl bg-slate-100 animate-pulse" />;
  }

  if (role === "DOCTOR") {
    return (
      <AppointmentListPage
        title="Manage Bookings"
        description="Review, update, and coordinate your patient bookings instead of using the booking wizard."
      />
    );
  }

  return <BookAppointmentPage />;
}
