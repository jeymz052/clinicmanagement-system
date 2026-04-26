import { httpError, ok, requireActor } from "@/src/lib/http";
import { renderTemplate } from "@/src/lib/services/notifier";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type NotificationRow = {
  id: string;
  channel: "email" | "sms";
  template: string;
  payload: Record<string, unknown>;
  status: "queued" | "sent" | "failed";
  created_at: string;
  send_at: string;
  sent_at: string | null;
};

type NotificationFeedItem = {
  id: string;
  template: string;
  payload: Record<string, unknown>;
  status: "queued" | "sent" | "failed";
  created_at: string;
  send_at: string;
  sent_at: string | null;
  channels: Array<"email" | "sms">;
};

function buildNotificationEventKey(item: NotificationRow) {
  const appointmentId = typeof item.payload.appointment_id === "string" ? item.payload.appointment_id : "";
  const billingId = typeof item.payload.billing_id === "string" ? item.payload.billing_id : "";
  return [item.template, appointmentId, billingId, item.send_at].join(":");
}

function mergeStatus(current: NotificationFeedItem["status"], next: NotificationRow["status"]) {
  if (current === "failed" || next === "failed") return "failed";
  if (current === "queued" || next === "queued") return "queued";
  return "sent";
}

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("notifications")
      .select("id, channel, template, payload, status, created_at, send_at, sent_at")
      .eq("user_id", actor.id)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;

    const feed = new Map<string, NotificationFeedItem>();

    for (const item of (data ?? []) as NotificationRow[]) {
      const key = buildNotificationEventKey(item);
      const existing = feed.get(key);

      if (!existing) {
        feed.set(key, {
          id: item.id,
          template: item.template,
          payload: item.payload,
          status: item.status,
          created_at: item.created_at,
          send_at: item.send_at,
          sent_at: item.sent_at,
          channels: [item.channel],
        });
        continue;
      }

      existing.status = mergeStatus(existing.status, item.status);
      if (item.sent_at && (!existing.sent_at || item.sent_at > existing.sent_at)) {
        existing.sent_at = item.sent_at;
      }
      if (!existing.channels.includes(item.channel)) {
        existing.channels.push(item.channel);
      }
    }

    const notifications = [...feed.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 8)
      .map((item) => {
      const rendered = renderTemplate(item.template, item.payload);
      return {
        ...item,
        subject: rendered.subject,
        body: rendered.body,
      };
    });

    return ok({ notifications });
  } catch (e) {
    return httpError(e);
  }
}
