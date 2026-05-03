import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/src/lib/cron";
import {
  cleanupOrphanedReservations,
  markNoShowAppointments,
} from "@/src/lib/services/maintenance";

/**
 * POST /api/v2/maintenance/cron
 * 
 * Runs maintenance tasks:
 * 1. Clean up orphaned pending online reservations (> 1 hour old)
 * 2. Auto-mark no-show appointments (past time + not marked yet)
 * 
 * Protected by Vercel Cron signature verification
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const results = await Promise.all([
      cleanupOrphanedReservations(),
      markNoShowAppointments(),
    ]);

    return NextResponse.json({
      ok: true,
      tasks: {
        orphaned_reservations: results[0],
        no_show_appointments: results[1],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[maintenance/cron]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
