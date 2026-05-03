/**
 * Maintenance Cron Jobs
 * 
 * Tasks:
 * 1. Clean up orphaned pending online reservations (> 1 hour old)
 * 2. Auto-mark no-show appointments (past time + not marked yet)
 * 3. Send reminder notifications (24 hours before, 1 hour before)
 */

import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export async function cleanupOrphanedReservations() {
  const supabase = getSupabaseAdmin();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const { error } = await supabase
      .from("online_booking_reservations")
      .update({ status: "Expired" })
      .eq("status", "Pending")
      .lt("created_at", oneHourAgo);

    if (error) throw error;

    return { ok: true as const, message: "Orphaned reservations cleaned up" };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function markNoShowAppointments() {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  try {
    // Get appointments that are:
    // 1. Status = Confirmed or InProgress
    // 2. End time is in the past (in UTC)
    // 3. Not already marked as NoShow or Completed
    const { data: pastAppointments, error: queryErr } = await supabase
      .from("appointments")
      .select("id, patient_id")
      .in("status", ["Confirmed", "InProgress"])
      .lt("slot_range", now);

    if (queryErr) throw queryErr;

    if (!pastAppointments || pastAppointments.length === 0) {
      return {
        ok: true as const,
        message: "No appointments to mark as no-show",
        count: 0,
      };
    }

    // Mark as NoShow
    const { error: updateErr } = await supabase
      .from("appointments")
      .update({ status: "NoShow" })
      .in(
        "id",
        pastAppointments.map((a) => a.id),
      );

    if (updateErr) throw updateErr;

    return {
      ok: true as const,
      message: `Marked ${pastAppointments.length} appointments as no-show`,
      count: pastAppointments.length,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Recalculate queue numbers for a slot after an appointment is cancelled/deleted
 * This ensures queue numbers stay sequential (1, 2, 3, ...)
 */
export async function recalculateQueueNumbersForSlot(input: {
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
}) {
  const supabase = getSupabaseAdmin();

  try {
    // Get all active appointments in this slot (excluding cancelled/noshow)
    const { data: appointments, error: queryErr } = await supabase
      .from("appointments")
      .select("id, queue_number, status")
      .eq("doctor_id", input.doctor_id)
      .eq("appointment_date", input.appointment_date)
      .eq("start_time", input.start_time)
      .eq("end_time", input.end_time)
      .not("status", "in", '(Cancelled,NoShow)')
      .order("queue_number", { ascending: true });

    if (queryErr) throw queryErr;

    if (!appointments || appointments.length === 0) {
      return { ok: true as const, count: 0 };
    }

    // Recalculate sequential queue numbers
    const updates = appointments.map((appt, index) => ({
      id: appt.id,
      queue_number: index + 1,
    }));

    // Update each appointment
    let updated = 0;
    for (const update of updates) {
      const { error: updateErr } = await supabase
        .from("appointments")
        .update({ queue_number: update.queue_number })
        .eq("id", update.id);

      if (!updateErr) updated++;
    }

    return {
      ok: true as const,
      count: updated,
      message: `Recalculated ${updated} queue numbers`,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
