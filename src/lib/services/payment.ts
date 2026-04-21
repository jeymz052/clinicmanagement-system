import { createHmac, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor } from "@/src/lib/http";
import type { Appointment, Payment, PaymentMethod } from "@/src/lib/db/types";
import { getAppointment, getDoctor } from "@/src/lib/services/booking";
import { enqueueNotification } from "@/src/lib/services/notification";

const MEETING_BASE = process.env.MEETING_BASE_URL ?? "https://meet.chiara.clinic";
const ONLINE_ALLOWED_METHODS = new Set<PaymentMethod>(["QR", "Card", "BankTransfer"]);

function buildMeetingLink(appt: Appointment) {
  const token = randomUUID().slice(0, 8);
  return `${MEETING_BASE}/${appt.id}-${token}`;
}

export async function createPaymentIntent(
  appointmentId: string,
  method: PaymentMethod,
  actor: Actor,
): Promise<Payment> {
  if (!ONLINE_ALLOWED_METHODS.has(method)) {
    throw new HttpError(400, "Online consultations only accept QR, Card, or Bank Transfer.");
  }

  const appt = await getAppointment(appointmentId);
  if (actor.profile.role === "patient" && actor.id !== appt.patient_id)
    throw new HttpError(403, "Forbidden");
  if (appt.appointment_type !== "Online")
    throw new HttpError(400, "Payment intent only applies to online consultations");
  if (appt.status !== "PendingPayment")
    throw new HttpError(400, `Cannot create payment for status ${appt.status}`);

  const doctor = await getDoctor(appt.doctor_id);

  const supabase = getSupabaseAdmin();
  await supabase
    .from("payments")
    .update({ status: "Failed" })
    .eq("appointment_id", appt.id)
    .eq("status", "Pending");

  const { data, error } = await supabase
    .from("payments")
    .insert({
      appointment_id: appt.id,
      amount: doctor.consultation_fee_online,
      method,
      status: "Pending",
      provider: method === "Card" ? "stripe" : method === "QR" ? "qr" : "bank_transfer",
      provider_ref: `intent_${randomUUID()}`,
    })
    .select()
    .single<Payment>();
  if (error) throw error;
  return data;
}

export async function listOnlinePayments(
  actor: Actor,
  appointmentIds?: string[],
): Promise<Array<Payment & { appointment: Appointment | null }>> {
  const supabase = getSupabaseAdmin();
  let appointmentQuery = supabase
    .from("appointments")
    .select("*")
    .eq("appointment_type", "Online");

  if (actor.profile.role === "patient") {
    appointmentQuery = appointmentQuery.eq("patient_id", actor.id);
  }

  if (appointmentIds && appointmentIds.length > 0) {
    appointmentQuery = appointmentQuery.in("id", appointmentIds);
  }

  const { data: appointments, error: apptError } = await appointmentQuery;
  if (apptError) throw apptError;

  const onlineAppointments = (appointments ?? []) as Appointment[];
  const allowedIds = onlineAppointments.map((appointment) => appointment.id);
  if (allowedIds.length === 0) return [];

  const appointmentById = new Map(onlineAppointments.map((appointment) => [appointment.id, appointment]));
  const { data: payments, error } = await supabase
    .from("payments")
    .select("*")
    .in("appointment_id", allowedIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((payments ?? []) as Payment[]).map((payment) => ({
    ...payment,
    appointment: payment.appointment_id ? appointmentById.get(payment.appointment_id) ?? null : null,
  }));
}

export async function setPaymentStatusById(
  paymentId: string,
  nextStatus: "Paid" | "Failed",
  actor: Actor,
): Promise<{ appointment: Appointment | null; payment: Payment }> {
  const supabase = getSupabaseAdmin();
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single<Payment>();
  if (error || !payment) throw new HttpError(404, "Payment not found");

  if (!payment.appointment_id) {
    throw new HttpError(400, "This payment is not linked to an online consultation.");
  }

  const appointment = await getAppointment(payment.appointment_id);
  if (appointment.appointment_type !== "Online") {
    throw new HttpError(400, "Only online consultation payments are supported here.");
  }
  if (actor.profile.role === "patient" && actor.id !== appointment.patient_id) {
    throw new HttpError(403, "Forbidden");
  }

  return nextStatus === "Paid"
    ? confirmPaymentByRef(payment.provider ?? "manual", payment.provider_ref ?? "")
    : { payment: await failPaymentByRef(payment.provider ?? "manual", payment.provider_ref ?? ""), appointment };
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

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature !== expected) throw new HttpError(401, "Invalid signature");
}
