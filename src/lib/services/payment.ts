import { createHmac, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, isStaff, type Actor } from "@/src/lib/http";
import type {
  Appointment,
  OnlineBookingReservation,
  Payment,
  PaymentMethod,
} from "@/src/lib/db/types";
import { getAppointment, getDoctor } from "@/src/lib/services/booking";
import { enqueueNotification } from "@/src/lib/services/notification";
import { calculateOnlineConsultationCharge } from "@/src/lib/consultation-pricing";
import { createPayMongoCheckoutSession, mapCheckoutMethods } from "@/src/lib/services/paymongo";
import { createStripeCheckoutSessionForReservation } from "@/src/lib/services/stripe";
import {
  resolveBookingPatientId,
  resolveAssignedDoctorUuid,
  validateSharedSlotOrThrow,
  type AppointmentCreatePayload,
} from "@/src/lib/server/appointments-store";
import { addOneHour } from "@/src/lib/server/legacy-bridge";

const MEETING_BASE = process.env.MEETING_BASE_URL ?? "https://meet.chiara.clinic";
const DEFAULT_MANUAL_TRANSFER_INSTRUCTIONS =
  "Send the transfer to the clinic's bank account, then wait for staff verification. Your appointment stays unconfirmed until payment is marked as paid.";

export type OnlineCheckoutOption =
  | "paymongo_gcash"
  | "paymongo_card"
  | "stripe_card"
  | "bank_transfer";

export type OnlineCheckoutBookingInput = Pick<
  AppointmentCreatePayload,
  "patientName" | "email" | "phone" | "doctorId" | "date" | "start" | "reason"
>;

function buildMeetingLink(appt: Appointment) {
  const token = randomUUID().slice(0, 8);
  return `${MEETING_BASE}/${appt.id}-${token}`;
}

function paymentMethodFromProvider(provider: string): PaymentMethod {
  if (provider === "paymongo_card" || provider === "stripe" || provider === "stripe_card") return "Card";
  if (provider === "paymongo_gcash" || provider === "gcash" || provider === "qr") return "QR";
  return "BankTransfer";
}

function getManualTransferInstructions() {
  return process.env.ONLINE_BANK_TRANSFER_INSTRUCTIONS ?? DEFAULT_MANUAL_TRANSFER_INSTRUCTIONS;
}

function buildManualTransferReference(reservationId: string) {
  return `BT-${reservationId.slice(0, 8).toUpperCase()}`;
}

async function findReservationByPaymentRef(
  provider: string,
  provider_ref: string,
): Promise<OnlineBookingReservation | null> {
  const supabase = getSupabaseAdmin();

  const { data: exact, error: exactError } = await supabase
    .from("online_booking_reservations")
    .select("*")
    .eq("payment_provider", provider)
    .eq("payment_ref", provider_ref)
    .maybeSingle<OnlineBookingReservation>();
  if (exactError) throw exactError;
  if (exact) return exact;

  const { data: fallback, error: fallbackError } = await supabase
    .from("online_booking_reservations")
    .select("*")
    .eq("payment_ref", provider_ref)
    .maybeSingle<OnlineBookingReservation>();
  if (fallbackError) throw fallbackError;
  return fallback ?? null;
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
  input: OnlineCheckoutBookingInput & {
    reservationId?: string;
    checkoutOption?: OnlineCheckoutOption;
  },
  actor: Actor,
): Promise<{
  url: string | null;
  reservation: OnlineBookingReservation;
  checkoutMode: "redirect" | "manual";
  instructions?: string;
  paymentReference?: string;
}> {
  if (actor.profile.role !== "patient" && actor.profile.role !== "secretary" && actor.profile.role !== "super_admin" && actor.profile.role !== "admin") {
    throw new HttpError(403, "Forbidden");
  }

  const doctorId = await resolveAssignedDoctorUuid();
  const patientId = await resolveBookingPatientId(input, {
    actorRole: actor.profile.role === "patient" ? "PATIENT" : undefined,
    actorUserId: actor.profile.role === "patient" ? actor.id : undefined,
  });
  const start_time = `${input.start}:00`;
  const end_time = `${addOneHour(input.start)}:00`;
  await getDoctor(doctorId);
  const amount = calculateOnlineConsultationCharge(start_time, end_time);

  const supabase = getSupabaseAdmin();
  const checkoutOption = input.checkoutOption ?? "paymongo_gcash";

  // If a reservationId was provided, reuse the existing reservation
  if (input.reservationId) {
    const { data: existing, error: existingErr } = await supabase
      .from("online_booking_reservations")
      .select("*")
      .eq("id", input.reservationId)
      .maybeSingle<OnlineBookingReservation>();
    if (existingErr) throw existingErr;
    if (!existing) throw new HttpError(404, "Reservation not found");
    if (existing.status !== "Pending") throw new HttpError(409, "Reservation is not pending");

    try {
      if (checkoutOption === "bank_transfer") {
        const paymentReference = existing.payment_ref ?? buildManualTransferReference(existing.id);
        const { data: updated, error: updateError } = await supabase
          .from("online_booking_reservations")
          .update({
            payment_provider: "bank_transfer",
            payment_ref: paymentReference,
            status: "Pending",
          })
          .eq("id", existing.id)
          .select()
          .single<OnlineBookingReservation>();
        if (updateError) throw updateError;

        return {
          url: null,
          reservation: updated,
          checkoutMode: "manual",
          instructions: getManualTransferInstructions(),
          paymentReference,
        };
      }

      if (checkoutOption === "stripe_card") {
        const checkout = await createStripeCheckoutSessionForReservation({
          reservation: existing,
          customerEmail: input.email,
        });

        const { data: updated, error: updateError } = await supabase
          .from("online_booking_reservations")
          .update({ payment_provider: "stripe", payment_ref: checkout.session.id })
          .eq("id", existing.id)
          .select()
          .single<OnlineBookingReservation>();
        if (updateError) throw updateError;

        return {
          url: checkout.session.url,
          reservation: updated,
          checkoutMode: "redirect",
        };
      }

      const checkout = await createPayMongoCheckoutSession({
        description: `Online consultation on ${existing.appointment_date}`,
        amount: existing.amount,
        customerEmail: input.email,
        customerName: input.patientName,
        customerPhone: input.phone,
        paymentMethods: mapCheckoutMethods([checkoutOption === "paymongo_card" ? "Card" : "GCash"]),
        successPath: `/appointments?reservation_paid=${encodeURIComponent(existing.id)}`,
        metadata: { reservation_id: existing.id },
      });

      const { data: updated, error: updateError } = await supabase
        .from("online_booking_reservations")
        .update({
          payment_provider: checkoutOption === "paymongo_card" ? "paymongo_card" : "paymongo_gcash",
          payment_ref: checkout.sessionId,
        })
        .eq("id", existing.id)
        .select()
        .single<OnlineBookingReservation>();
      if (updateError) throw updateError;

      return {
        url: checkout.checkoutUrl,
        reservation: updated,
        checkoutMode: "redirect",
      };
    } catch (error) {
      if (checkoutOption !== "bank_transfer") {
        await supabase
          .from("online_booking_reservations")
          .update({ status: "Failed" })
          .eq("id", existing.id);
      }
      throw error;
    }
  }

  // Otherwise create a new reservation as before
  const { queueNumber } = await validateSharedSlotOrThrow({
    doctorUuid: doctorId,
    date: input.date,
    start_time,
    end_time,
    type: "Online",
  });

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
    if (checkoutOption === "bank_transfer") {
      const paymentReference = buildManualTransferReference(reservation.id);
      const { data: updated, error: updateError } = await supabase
        .from("online_booking_reservations")
        .update({
          payment_provider: "bank_transfer",
          payment_ref: paymentReference,
          status: "Pending",
        })
        .eq("id", reservation.id)
        .select()
        .single<OnlineBookingReservation>();
      if (updateError) throw updateError;

      return {
        url: null,
        reservation: updated,
        checkoutMode: "manual",
        instructions: getManualTransferInstructions(),
        paymentReference,
      };
    }

    if (checkoutOption === "stripe_card") {
      const checkout = await createStripeCheckoutSessionForReservation({
        reservation,
        customerEmail: input.email,
      });

      const { data: updated, error: updateError } = await supabase
        .from("online_booking_reservations")
        .update({ payment_provider: "stripe", payment_ref: checkout.session.id })
        .eq("id", reservation.id)
        .select()
        .single<OnlineBookingReservation>();
      if (updateError) throw updateError;

      return {
        url: checkout.session.url,
        reservation: updated,
        checkoutMode: "redirect",
      };
    }

    const checkout = await createPayMongoCheckoutSession({
      description: `Online consultation on ${reservation.appointment_date}`,
      amount,
      customerEmail: input.email,
      customerName: input.patientName,
      customerPhone: input.phone,
      paymentMethods: mapCheckoutMethods([checkoutOption === "paymongo_card" ? "Card" : "GCash"]),
      successPath: `/appointments?reservation_paid=${encodeURIComponent(reservation.id)}`,
      metadata: { reservation_id: reservation.id },
    });

    const { data: updated, error: updateError } = await supabase
      .from("online_booking_reservations")
      .update({
        payment_provider: checkoutOption === "paymongo_card" ? "paymongo_card" : "paymongo_gcash",
        payment_ref: checkout.sessionId,
      })
      .eq("id", reservation.id)
      .select()
      .single<OnlineBookingReservation>();
    if (updateError) throw updateError;

    return {
      url: checkout.checkoutUrl,
      reservation: updated,
      checkoutMode: "redirect",
    };
  } catch (error) {
    if (checkoutOption !== "bank_transfer") {
      await supabase.from("online_booking_reservations").update({ status: "Failed" }).eq("id", reservation.id);
    }
    throw error;
  }
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
  const resolvedReservation = reservation ?? await findReservationByPaymentRef(provider, provider_ref);
  if (!resolvedReservation) throw new HttpError(404, "Payment not found");

  const result = await confirmReservationPayment(
    resolvedReservation.status === "Pending"
      ? resolvedReservation
      : { ...resolvedReservation, status: "Paid" },
  );

  await supabase
    .from("online_booking_reservations")
    .update({ status: "Paid" })
    .eq("id", resolvedReservation.id)
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
    .maybeSingle<OnlineBookingReservation>();
  if (reservationError) throw reservationError;

  const resolvedReservation = reservation
    ?? await (async () => {
      const fallback = await findReservationByPaymentRef(provider, provider_ref);
      if (!fallback) return null;
      const { data: updated, error: updateError } = await supabase
        .from("online_booking_reservations")
        .update({ status: "Failed" })
        .eq("id", fallback.id)
        .select()
        .single<OnlineBookingReservation>();
      if (updateError) throw updateError;
      return updated;
    })();
  if (!resolvedReservation) throw new HttpError(404, "Payment not found");

  await enqueueNotification({
    user_id: resolvedReservation.patient_id,
    template: "appointment_payment_failed",
    channels: ["email"],
    payload: { reservation_id: resolvedReservation.id },
  });

  if (!resolvedReservation.appointment_id) {
    return {
      id: `failed-${resolvedReservation.id}`,
      appointment_id: null,
      billing_id: null,
      amount: resolvedReservation.amount,
      method: paymentMethodFromProvider(resolvedReservation.payment_provider ?? provider),
      status: "Failed",
      provider: resolvedReservation.payment_provider ?? provider,
      provider_ref,
      paid_at: null,
      created_at: new Date().toISOString(),
    };
  }

  const { data: syntheticPayment, error: syntheticError } = await supabase
    .from("payments")
    .insert({
      appointment_id: resolvedReservation.appointment_id,
      amount: resolvedReservation.amount,
      method: paymentMethodFromProvider(resolvedReservation.payment_provider ?? provider),
      status: "Failed",
      provider: resolvedReservation.payment_provider ?? provider,
      provider_ref,
    })
    .select()
    .single<Payment>();
  if (syntheticError) throw syntheticError;

  return syntheticPayment;
}

export async function confirmManualBankTransferReservation(
  reservationId: string,
  actor: Actor,
) {
  if (!isStaff(actor.profile.role)) {
    throw new HttpError(403, "Only clinic staff can confirm bank transfers.");
  }

  const supabase = getSupabaseAdmin();
  const { data: reservation, error } = await supabase
    .from("online_booking_reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle<OnlineBookingReservation>();
  if (error) throw error;
  if (!reservation) throw new HttpError(404, "Reservation not found");
  if (reservation.payment_provider !== "bank_transfer") {
    throw new HttpError(400, "Reservation is not awaiting bank transfer verification.");
  }
  if (!reservation.payment_ref) {
    throw new HttpError(400, "Reservation has no bank transfer reference.");
  }

  return confirmPaymentByRef("bank_transfer", reservation.payment_ref);
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
