import { httpError, ok } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { renderTemplate, sendEmail, sendSms } from "@/src/lib/services/notifier";

type NotificationRow = {
  id: string;
  user_id: string | null;
  channel: "email" | "sms";
  template: string;
  payload: Record<string, unknown>;
  status: string;
  send_at: string;
};

/**
 * POST /api/v2/notifications/drain
 * Processes queued notifications whose send_at <= now().
 * Protected by CRON_SECRET header so only your scheduler can call it.
 * Returns counts of processed, succeeded, failed.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("x-cron-secret") !== secret) {
      return ok({ message: "Forbidden" }, 403);
    }

    const supabase = getSupabaseAdmin();

    const { data: queued, error } = await supabase
      .from("notifications")
      .select("id, user_id, channel, template, payload, status, send_at")
      .eq("status", "queued")
      .lte("send_at", new Date().toISOString())
      .limit(100);
    if (error) throw error;

    const rows = (queued ?? []) as NotificationRow[];
    if (rows.length === 0) return ok({ processed: 0, succeeded: 0, failed: 0 });

    const userIds = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, phone")
      .in("id", userIds);
    const profilesById = new Map(
      (profiles ?? []).map((p) => [p.id as string, p as { id: string; email: string; phone: string | null }]),
    );

    let succeeded = 0;
    let failed = 0;

    await Promise.all(
      rows.map(async (row) => {
        try {
          const profile = row.user_id ? profilesById.get(row.user_id) : null;
          if (!profile) throw new Error("Recipient profile missing");

          const { subject, body } = renderTemplate(row.template, row.payload);

          if (row.channel === "email") {
            await sendEmail({ to: profile.email, subject, body });
          } else {
            if (!profile.phone) throw new Error("No phone on profile");
            await sendSms({ to: profile.phone, body });
          }

          await supabase
            .from("notifications")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", row.id);
          succeeded++;
        } catch (e) {
          failed++;
          await supabase
            .from("notifications")
            .update({
              status: "failed",
              error: e instanceof Error ? e.message : "Unknown error",
            })
            .eq("id", row.id);
        }
      }),
    );

    return ok({ processed: rows.length, succeeded, failed });
  } catch (e) {
    return httpError(e);
  }
}
