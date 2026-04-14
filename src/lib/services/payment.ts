import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor, isStaff } from "@/src/lib/http";
import type { Appointment, Payment, PaymentMethod } from "@/src/lib/db/types";
import { getAppointment, getDoctor } from "@/src/lib/services/booking";
import { enqueueNotification } from "@/src/lib/services/notification";

const MEETING_BASE = process.env.MEETING_BASE_URL ?? "https://meet.chiara.clinic";

function buildMeetingLink(appt: Appointment) {
  const token = randomUUID().slice(0, 8);
  return `${MEETING_BASE}/${appt.id}-${token}`;
}

export async function createPaymentIntent(
  appointmentId: string,
  method: PaymentMethod,
  actor: Actor,
): Promise<Payment> {
  const appt = await getAppointment(appointmentId);
  if (actor.profile.role === "patient" && actor.id !== appt.patient_id)
    throw new HttpError(403, "Forbidden");
  if (appt.appointment_type !== "Online")
    throw new HttpError(400, "Payment intent only applies to online consultations");
  if (appt.status !== "PendingPayment")
    throw new HttpError(400, `Cannot create payment for status ${appt.status}`);

  const doctor = await getDoctor(appt.doctor_id);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      appointment_id: appt.id,
      amount: doctor.consultation_fee_online,
      method,
      status: "Pending",
      provider: method === "Card" ? "stripe" : "manual",
      provider_ref: `intent_${randomUUID()}`,
    })
    .select()
    .single<Payment>();
  if (error) throw error;
  return data;
}

export async function confirmPaymentByRef(
  provider: string,
  provider_ref: string,
): Promise<{ appointment: Appointment | null; payment: Payment }> {
  const supabase = getSupabaseAdmin();
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("provider", provider)
    .eq("provider_ref", provider_ref)
    .maybeSingle<Payment>();
  if (error) throw error;
  if (!payment) throw new HttpError(404, "Payment not found");
  if (payment.status === "Paid") {
    const appt = payment.appointment_id ? await getAppointment(payment.appointment_id) : null;
    return { payment, appointment: appt };
  }

  const { data: paid, error: updateErr } = await supabase
    .from("payments")
    .update({ status: "Paid", paid_at: new Date().toISOString() })
    .eq("id", payment.id)
    .select()
    .single<Payment>();
  if (updateErr) throw updateErr;

  let appt: Appointment | null = null;
  if (paid.appointment_id) {
    appt = await getAppointment(paid.appointment_id);
    if (appt.status === "PendingPayment") {
      const link = buildMeetingLink(appt);
      const { data: updated, error: apptErr } = await supabase
        .from("appointments")
        .update({ status: "Confirmed", meeting_link: link })
        .eq("id", appt.id)
        .select()
        .single<Appointment>();
      if (apptErr) throw apptErr;
      appt = updated;
      await enqueueNotification({
        user_id: appt.patient_id,
        template: "appointment_paid_and_confirmed",
        channels: ["email", "sms"],
        payload: { appointment_id: appt.id, meeting_link: link },
      });
    }
  }
  return { payment: paid, appointment: appt };
}

export async function failPaymentByRef(provider: string, provider_ref: string): Promise<Payment> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "Failed" })
    .eq("provider", provider)
    .eq("provider_ref", provider_ref)
    .select()
    .single<Payment>();
  if (error) throw error;
  if (data.appointment_id) {
    const appt = await getAppointment(data.appointment_id);
    await enqueueNotification({
      user_id: appt.patient_id,
      template: "appointment_payment_failed",
      channels: ["email"],
      payload: { appointment_id: appt.id },
    });
  }
  return data;
}

export async function reapUnpaidOnline(minutes = 30) {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "Cancelled" })
    .eq("appointment_type", "Online")
    .eq("status", "PendingPayment")
    .lt("created_at", cutoff)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export function verifyWebhookSignature(req: Request, rawBody: string): void {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(500, "PAYMENT_WEBHOOK_SECRET not configured");
  const signature = req.headers.get("x-webhook-signature");
  if (!signature) throw new HttpError(401, "Missing signature");

  const crypto = require("node:crypto") as typeof import("node:crypto");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature !== expected) throw new HttpError(401, "Invalid signature");
}
