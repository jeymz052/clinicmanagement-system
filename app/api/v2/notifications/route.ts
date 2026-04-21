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

    const notifications = ((data ?? []) as NotificationRow[]).map((item) => {
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
