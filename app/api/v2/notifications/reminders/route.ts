import { httpError, ok } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { enqueueNotification } from "@/src/lib/services/notification";

/**
 * POST /api/v2/notifications/reminders
 * Enqueues 24h and 6h reminders for upcoming appointments that don't have one yet.
 * Run on a cron every 15 minutes.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("x-cron-secret") !== secret) {
      return ok({ message: "Forbidden" }, 403);
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find confirmed appointments starting between now and 25h from now
    const nowIso = now.toISOString();
    const horizonIso = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_date, start_time, status, appointment_type, meeting_link")
      .in("status", ["Confirmed"])
      .gte("appointment_date", nowIso.slice(0, 10))
      .lte("appointment_date", horizonIso.slice(0, 10));
    if (error) throw error;

    let enqueued24 = 0;
    let enqueued6 = 0;

    for (const row of appts ?? []) {
      const r = row as {
        id: string;
        patient_id: string;
        appointment_date: string;
        start_time: string;
        meeting_link: string | null;
      };
      const startAt = new Date(`${r.appointment_date}T${r.start_time}Z`);

      // 24h reminder window: starts 23h50m to 24h10m ahead → enqueue once
      const ms24 = startAt.getTime() - in24h.getTime();
      if (Math.abs(ms24) < 15 * 60 * 1000) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("template", "appointment_reminder_24h")
          .eq("user_id", r.patient_id)
          .contains("payload", { appointment_id: r.id })
          .maybeSingle();
        if (!existing) {
          await enqueueNotification({
            user_id: r.patient_id,
            template: "appointment_reminder_24h",
            channels: ["email", "sms"],
            payload: { appointment_id: r.id, meeting_link: r.meeting_link },
          });
          enqueued24++;
        }
      }

      // 6h reminder
      const ms6 = startAt.getTime() - in6h.getTime();
      if (Math.abs(ms6) < 15 * 60 * 1000) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("template", "appointment_reminder_6h")
          .eq("user_id", r.patient_id)
          .contains("payload", { appointment_id: r.id })
          .maybeSingle();
        if (!existing) {
          await enqueueNotification({
            user_id: r.patient_id,
            template: "appointment_reminder_6h",
            channels: ["email", "sms"],
            payload: { appointment_id: r.id, meeting_link: r.meeting_link },
          });
          enqueued6++;
        }
      }
    }

    return ok({ scanned: appts?.length ?? 0, enqueued_24h: enqueued24, enqueued_6h: enqueued6 });
  } catch (e) {
    return httpError(e);
  }
}
