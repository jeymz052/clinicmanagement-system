import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { getAppointment, getDoctor } from "@/src/lib/services/booking";
import { createStripeCheckoutSession } from "@/src/lib/services/stripe";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { calculateConsultationCharge } from "@/src/lib/consultation-pricing";

/**
 * POST /api/v2/payments/checkout
 * Body: { appointment_id }
 * Creates a Stripe Checkout Session and returns the url the UI must redirect to.
 */
export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = (await req.json()) as { appointment_id?: string };
    if (!body.appointment_id) throw new HttpError(400, "appointment_id required");

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

    // Find the patient's email
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", appt.patient_id)
      .single<{ email: string }>();
    if (!profile) throw new HttpError(400, "Patient profile missing");

    const { session } = await createStripeCheckoutSession({
      appointment: appt,
      amount,
      customerEmail: profile.email,
    });

    return ok({ url: session.url });
  } catch (e) {
    return httpError(e);
  }
}
