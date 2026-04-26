import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { getAppointment } from "@/src/lib/services/booking";
import {
  createOnlineCheckoutSession,
} from "@/src/lib/services/payment";
import { createPayMongoCheckoutSession, mapCheckoutMethods } from "@/src/lib/services/paymongo";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { calculateConsultationCharge } from "@/src/lib/consultation-pricing";
import { getDoctor } from "@/src/lib/services/booking";

type LegacyCheckoutBody = { appointment_id?: string; method?: "Card" | "GCash" };
type BookingCheckoutBody = {
  patientName?: string;
  email?: string;
  phone?: string;
  doctorId?: string;
  date?: string;
  start?: string;
  reason?: string;
  type?: "Online";
};

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = (await req.json()) as LegacyCheckoutBody & BookingCheckoutBody;

    if (body.appointment_id) {
      const appt = await getAppointment(body.appointment_id);
      if (actor.profile.role === "patient" && appt.patient_id !== actor.id)
        throw new HttpError(403, "Forbidden");
      if (appt.appointment_type !== "Online")
        throw new HttpError(400, "Checkout only applies to online consultations");
      if (appt.status !== "PendingPayment")
        throw new HttpError(400, `Cannot create checkout for status ${appt.status}`);

      const doctor = await getDoctor(appt.doctor_id);
      const amount = calculateConsultationCharge(
        Number(doctor.consultation_fee_online),
        appt.start_time,
        appt.end_time,
      );

      const supabase = getSupabaseAdmin();
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", appt.patient_id)
        .single<{ email: string }>();
      if (!profile) throw new HttpError(400, "Patient profile missing");

      const checkoutMethod = body.method === "GCash" ? "GCash" : "Card";
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          appointment_id: appt.id,
          amount,
          method: checkoutMethod,
          status: "Pending",
          provider: "paymongo",
          provider_ref: null,
        })
        .select("id")
        .single<{ id: string }>();
      if (paymentError || !payment) throw paymentError ?? new HttpError(500, "Unable to initialize PayMongo payment.");

      const session = await createPayMongoCheckoutSession({
        description: `Online consultation on ${appt.appointment_date}`,
        amount,
        customerEmail: profile.email,
        paymentMethods: mapCheckoutMethods([checkoutMethod]),
        successPath: `/payments?provider=paymongo&appointment_id=${encodeURIComponent(appt.id)}`,
        metadata: {
          payment_id: payment.id,
          appointment_id: appt.id,
        },
      });

      await supabase
        .from("payments")
        .update({ provider_ref: session.sessionId })
        .eq("id", payment.id);

      return ok({ url: session.checkoutUrl });
    }

    if (
      body.type !== "Online"
      || !body.patientName
      || !body.email
      || !body.phone
      || !body.doctorId
      || !body.date
      || !body.start
    ) {
      throw new HttpError(400, "Online booking details are required");
    }

    const result = await createOnlineCheckoutSession({
      patientName: body.patientName,
      email: body.email,
      phone: body.phone,
      doctorId: body.doctorId,
      date: body.date,
      start: body.start,
      reason: body.reason ?? "",
    }, actor);

    return ok({ url: result.url, reservation_id: result.reservation.id }, 201);
  } catch (e) {
    return httpError(e);
  }
}
