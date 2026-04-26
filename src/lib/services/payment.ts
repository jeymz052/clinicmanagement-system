import { createHmac, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor } from "@/src/lib/http";
import type {
  Appointment,
  OnlineBookingReservation,
  Payment,
  PaymentMethod,
} from "@/src/lib/db/types";
import { getAppointment, getDoctor } from "@/src/lib/services/booking";
import { enqueueNotification } from "@/src/lib/services/notification";
import { calculateConsultationCharge } from "@/src/lib/consultation-pricing";
import { createPayMongoCheckoutSession, mapCheckoutMethods } from "@/src/lib/services/paymongo";
import {
  resolveBookingPatientId,
  validateSharedSlotOrThrow,
  type AppointmentCreatePayload,
} from "@/src/lib/server/appointments-store";
import { addOneHour, resolveDoctorIdBySlug } from "@/src/lib/server/legacy-bridge";

const MEETING_BASE = process.env.MEETING_BASE_URL ?? "https://meet.chiara.clinic";
const ONLINE_ALLOWED_METHODS = new Set<PaymentMethod>(["QR", "GCash", "Card", "BankTransfer"]);

export type OnlineCheckoutBookingInput = Pick<
  AppointmentCreatePayload,
  "patientName" | "email" | "phone" | "doctorId" | "date" | "start" | "reason"
>;

function buildMeetingLink(appt: Appointment) {
  const token = randomUUID().slice(0, 8);
  return `${MEETING_BASE}/${appt.id}-${token}`;
}

function paymentMethodFromProvider(provider: string): PaymentMethod {
  if (provider === "paymongo") return "Card";
  if (provider === "gcash") return "GCash";
  if (provider === "qr") return "QR";
  return "BankTransfer";
}

async function notifyOnlineConfirmed(appt: Appointment, meetingLink: string) {
  await enqueueNotification({
    user_id: appt.patient_id,
    template: "appointment_confirmed",
    channels: ["email", "sms"],
    payload: { appointment_id: appt.id, meeting_link: meetingLink },
  });
  await enqueueNotification({
    user_id: appt.patient_id,
    template: "appointment_payment_success",
    channels: ["email", "sms"],
    payload: { appointment_id: appt.id, meeting_link: meetingLink },
  });
  await enqueueNotification({
    user_id: appt.patient_id,
    template: "online_meeting_link",
    channels: ["email", "sms"],
    payload: { appointment_id: appt.id, meeting_link: meetingLink },
  });
}

export async function createOnlineCheckoutSession(
  input: OnlineCheckoutBookingInput,
  actor: Actor,
): Promise<{ url: string; reservation: OnlineBookingReservation }> {
  if (actor.profile.role !== "patient" && actor.profile.role !== "secretary" && actor.profile.role !== "super_admin" && actor.profile.role !== "admin") {
    throw new HttpError(403, "Forbidden");
  }

  const doctorId = await resolveDoctorIdBySlug(input.doctorId);
  const patientId = await resolveBookingPatientId(input, {
    actorRole: actor.profile.role === "patient" ? "PATIENT" : undefined,
    actorUserId: actor.profile.role === "patient" ? actor.id : undefined,
  });
  const start_time = `${input.start}:00`;
  const end_time = `${addOneHour(input.start)}:00`;
  const { queueNumber } = await validateSharedSlotOrThrow({
    doctorUuid: doctorId,
    date: input.date,
    start_time,
    end_time,
    type: "Online",
  });

  const doctor = await getDoctor(doctorId);
  const amount = calculateConsultationCharge(
    Number(doctor.consultation_fee_online),
    start_time,
    end_time,
  );

  const supabase = getSupabaseAdmin();
  const { data: reservation, error: reservationError } = await supabase
    .from("online_booking_reservations")
    .insert({
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_date: input.date,
      start_time,
      end_time,
      queue_number: queueNumber,
      reason: input.reason,
      amount,
      status: "Pending",
    })
    .select()
    .single<OnlineBookingReservation>();
  if (reservationError) throw reservationError;

  try {
    const checkout = await createPayMongoCheckoutSession({
      description: `Online consultation on ${reservation.appointment_date}`,
      amount,
      customerEmail: input.email,
      customerName: input.patientName,
      customerPhone: input.phone,
      paymentMethods: mapCheckoutMethods(["Card", "GCash"]),
      successPath: `/payments?provider=paymongo&reservation_id=${encodeURIComponent(reservation.id)}`,
      metadata: {
        reservation_id: reservation.id,
      },
    });

    const { data: updated, error: updateError } = await supabase
      .from("online_booking_reservations")
      .update({
        payment_provider: "paymongo",
        payment_ref: checkout.sessionId,
      })
      .eq("id", reservation.id)
      .select()
      .single<OnlineBookingReservation>();
    if (updateError) throw updateError;

    return {
      url: checkout.checkoutUrl,
      reservation: updated,
    };
  } catch (error) {
    await supabase
      .from("online_booking_reservations")
      .update({ status: "Failed" })
      .eq("id", reservation.id);
    throw error;
  }
}

export async function createPaymentIntent(
  appointmentId: string,
  method: PaymentMethod,
  actor: Actor,
): Promise<Payment> {
  if (!ONLINE_ALLOWED_METHODS.has(method)) {
    throw new HttpError(400, "Online consultations only accept GCash/QR, Card, or Bank Transfer.");
  }

  const appt = await getAppointment(appointmentId);
  if (actor.profile.role === "patient" && actor.id !== appt.patient_id)
    throw new HttpError(403, "Forbidden");
  if (appt.appointment_type !== "Online")
    throw new HttpError(400, "Payment intent only applies to online consultations");
  if (appt.status !== "PendingPayment")
    throw new HttpError(400, `Cannot create payment for status ${appt.status}`);

  const doctor = await getDoctor(appt.doctor_id);
  const amount = calculateConsultationCharge(
    Number(doctor.consultation_fee_online),
    appt.start_time,
    appt.end_time,
  );

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
      amount,
      method,
      status: "Pending",
      provider:
        method === "Card"
          ? "paymongo"
          : method === "GCash"
            ? "gcash"
            : method === "QR"
              ? "qr"
              : "bank_transfer",
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
    ? confirmExistingPaymentById(payment.id)
    : { payment: await failExistingPaymentById(payment.id), appointment };
}

export async function confirmExistingPaymentById(
  paymentId: string,
  options: { provider?: string; provider_ref?: string | null } = {},
): Promise<{ appointment: Appointment | null; payment: Payment }> {
  const supabase = getSupabaseAdmin();
  const { data: payment, error } = await supabase
    .from("payments")
    .update({
      status: "Paid",
      paid_at: new Date().toISOString(),
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.provider_ref !== undefined ? { provider_ref: options.provider_ref } : {}),
    })
    .eq("id", paymentId)
    .select()
    .single<Payment>();
  if (error) throw error;

  let appt: Appointment | null = null;
  if (payment.appointment_id) {
    appt = await getAppointment(payment.appointment_id);
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
      await notifyOnlineConfirmed(appt, link);
    }
  }

  return { payment, appointment: appt };
}

export async function failExistingPaymentById(paymentId: string): Promise<Payment> {
  const supabase = getSupabaseAdmin();
  const { data: payment, error } = await supabase
    .from("payments")
    .update({ status: "Failed" })
    .eq("id", paymentId)
    .select()
    .single<Payment>();
  if (error) throw error;

  if (payment.appointment_id) {
    const appt = await getAppointment(payment.appointment_id);
    await enqueueNotification({
      user_id: appt.patient_id,
      template: "appointment_payment_failed",
      channels: ["email"],
      payload: { appointment_id: appt.id },
    });
  }

  return payment;
}

async function confirmReservationPayment(
  reservation: OnlineBookingReservation,
): Promise<{ appointment: Appointment; payment: Payment }> {
  const supabase = getSupabaseAdmin();

  if (reservation.appointment_id) {
    const appt = await getAppointment(reservation.appointment_id);
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("appointment_id", reservation.appointment_id)
      .eq("provider", reservation.payment_provider ?? "paymongo")
      .eq("provider_ref", reservation.payment_ref ?? "")
      .maybeSingle<Payment>();
    if (!payment) throw new HttpError(404, "Payment not found");
    return { appointment: appt, payment };
  }

  await validateSharedSlotOrThrow({
    doctorUuid: reservation.doctor_id,
    date: reservation.appointment_date,
    start_time: reservation.start_time,
    end_time: reservation.end_time,
    type: "Online",
    ignoreReservationId: reservation.id,
  });

  const { data: insertedAppointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      patient_id: reservation.patient_id,
      doctor_id: reservation.doctor_id,
      appointment_date: reservation.appointment_date,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      appointment_type: "Online",
      status: "Confirmed",
      queue_number: reservation.queue_number,
      reason: reservation.reason,
    })
    .select()
    .single<Appointment>();
  if (appointmentError) throw appointmentError;

  const meetingLink = buildMeetingLink(insertedAppointment);
  const { data: updatedAppointment, error: updateAppointmentError } = await supabase
    .from("appointments")
    .update({ meeting_link: meetingLink })
    .eq("id", insertedAppointment.id)
    .select()
    .single<Appointment>();
  if (updateAppointmentError) throw updateAppointmentError;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      appointment_id: updatedAppointment.id,
      amount: reservation.amount,
      method: paymentMethodFromProvider(reservation.payment_provider ?? "paymongo"),
      status: "Paid",
      provider: reservation.payment_provider ?? "paymongo",
      provider_ref: reservation.payment_ref,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single<Payment>();
  if (paymentError) throw paymentError;

  const { error: reservationError } = await supabase
    .from("online_booking_reservations")
    .update({
      status: "Converted",
      appointment_id: updatedAppointment.id,
    })
    .eq("id", reservation.id);
  if (reservationError) throw reservationError;

  await enqueueNotification({
    user_id: updatedAppointment.patient_id,
    template: "appointment_booked",
    channels: ["email", "sms"],
    payload: { appointment_id: updatedAppointment.id, appointment_type: "Online" },
  });
  await notifyOnlineConfirmed(updatedAppointment, meetingLink);

  return { appointment: updatedAppointment, payment };
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
  if (payment) {
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
        await notifyOnlineConfirmed(appt, link);
      }
    }
    return { payment: paid, appointment: appt };
  }

  const { data: reservation, error: reservationError } = await supabase
    .from("online_booking_reservations")
    .select("*")
    .eq("payment_provider", provider)
    .eq("payment_ref", provider_ref)
    .maybeSingle<OnlineBookingReservation>();
  if (reservationError) throw reservationError;
  if (!reservation) throw new HttpError(404, "Payment not found");

  const result = await confirmReservationPayment(
    reservation.status === "Pending"
      ? reservation
      : { ...reservation, status: "Paid" },
  );

  await supabase
    .from("online_booking_reservations")
    .update({ status: "Paid" })
    .eq("id", reservation.id)
    .in("status", ["Pending", "Paid"]);

  return result;
}

export async function failPaymentByRef(provider: string, provider_ref: string): Promise<Payment> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "Failed" })
    .eq("provider", provider)
    .eq("provider_ref", provider_ref)
    .select()
    .maybeSingle<Payment>();
  if (error) throw error;

  if (data) {
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

  const { data: reservation, error: reservationError } = await supabase
    .from("online_booking_reservations")
    .update({ status: "Failed" })
    .eq("payment_provider", provider)
    .eq("payment_ref", provider_ref)
    .select()
    .single<OnlineBookingReservation>();
  if (reservationError) throw reservationError;

  const { data: syntheticPayment, error: syntheticError } = await supabase
    .from("payments")
    .insert({
      appointment_id: reservation.appointment_id,
      amount: reservation.amount,
      method: paymentMethodFromProvider(provider),
      status: "Failed",
      provider,
      provider_ref,
    })
    .select()
    .single<Payment>();
  if (syntheticError) throw syntheticError;

  await enqueueNotification({
    user_id: reservation.patient_id,
    template: "appointment_payment_failed",
    channels: ["email"],
    payload: { reservation_id: reservation.id },
  });

  return syntheticPayment;
}

export async function reapUnpaidOnline(minutes = 30) {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("online_booking_reservations")
    .update({ status: "Expired" })
    .eq("status", "Pending")
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
