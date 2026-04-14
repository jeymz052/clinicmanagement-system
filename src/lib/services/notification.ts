import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { NotificationChannel } from "@/src/lib/db/types";

export type NotifyTemplate =
  | "welcome"
  | "appointment_confirmed"
  | "appointment_paid_and_confirmed"
  | "appointment_payment_failed"
  | "appointment_reminder_24h"
  | "appointment_cancelled"
  | "billing_issued";

export async function enqueueNotification(input: {
  user_id: string;
  template: NotifyTemplate;
  channels?: NotificationChannel[];
  payload: Record<string, unknown>;
  send_at?: string;
}) {
  const supabase = getSupabaseAdmin();
  const channels: NotificationChannel[] = input.channels ?? ["email"];
  const rows = channels.map((channel) => ({
    user_id: input.user_id,
    channel,
    template: input.template,
    payload: input.payload,
    send_at: input.send_at ?? new Date().toISOString(),
    status: "queued" as const,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;
}
