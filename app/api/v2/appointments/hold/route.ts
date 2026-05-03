import { httpError, ok, getActor } from "@/src/lib/http";
import { assertTrustedOrigin, enforceRateLimit } from "@/src/lib/security";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { resolveBookingPatientId, validateSharedSlotOrThrow, resolveAssignedDoctorUuid } from "@/src/lib/server/appointments-store";
import { addOneHour } from "@/src/lib/server/legacy-bridge";
import { calculateOnlineConsultationCharge } from "@/src/lib/consultation-pricing";
import { getDoctor } from "@/src/lib/services/booking";
import { enqueueNotification } from "@/src/lib/services/notification";

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);
    enforceRateLimit(req, "appointment-hold", 20, 60_000);

    const actor = await getActor(req);
    const body = await req.json();

    const {
      patientName,
      email,
      phone,
      doctorId, // optional, legacy uses assigned doctor
      date,
      start,
      type,
      reason,
    } = body as {
      patientName: string;
      email: string;
      phone: string;
      doctorId?: string;
      date: string;
      start: string;
      type: "Clinic" | "Online";
      reason?: string;
    };

    const doctorUuid = doctorId ? await resolveAssignedDoctorUuid() : await resolveAssignedDoctorUuid();
    const start_time = `${start}:00`;
    const end_time = `${addOneHour(start)}:00`;

    const { queueNumber } = await validateSharedSlotOrThrow({
      doctorUuid,
      date,
      start_time,
      end_time,
      type,
    });

    const patientId = await resolveBookingPatientId({ email, patientName, phone }, {
      actorRole: actor?.profile.role === "patient" ? "PATIENT" : undefined,
      actorUserId: actor?.profile.role === "patient" ? actor.id : undefined,
    });

    let amount = 0;
    if (type === "Online") {
      amount = calculateOnlineConsultationCharge(start_time, end_time);
    } else {
      const doctor = await getDoctor(doctorUuid);
      amount = doctor.consultation_fee_clinic ?? 0;
    }

    const supabase = getSupabaseAdmin();
    const { data: reservation, error } = await supabase
      .from("online_booking_reservations")
      .insert({
        patient_id: patientId,
        doctor_id: doctorUuid,
        appointment_date: date,
        start_time,
        end_time,
        queue_number: queueNumber,
        reason: reason ?? "",
        amount,
        status: "Pending",
      })
      .select()
      .single();
    if (error) throw error;

    // Notify patient via email (profile was created if it didn't exist)
    try {
      await enqueueNotification({
        user_id: patientId,
        template: "appointment_booked",
        channels: ["email"],
        payload: {
          reservation_id: reservation.id,
          appointment_date: reservation.appointment_date,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
          amount: reservation.amount,
          status: reservation.status,
        },
      });
    } catch (notifyErr) {
      console.error("Failed to enqueue reservation notification", notifyErr);
    }

    return ok({ reservation });
  } catch (e) {
    return httpError(e);
  }
}
