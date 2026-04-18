import { HttpError, httpError, ok } from "@/src/lib/http";
import {
  normalizePatientRegistrationFields,
  validatePatientRegistrationFields,
  type PatientRegistrationFields,
} from "@/src/lib/patient-registration";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type RegisterPayload = PatientRegistrationFields & {
  userId: string;
};

function assertRegisterPayload(payload: unknown): RegisterPayload {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Invalid registration payload.");
  }

  const body = payload as Partial<RegisterPayload>;
  const userId = body.userId?.trim();
  if (!userId) {
    throw new HttpError(400, "Missing user id.");
  }

  const fields = normalizePatientRegistrationFields({
    fullName: body.fullName ?? "",
    email: body.email ?? "",
    phone: body.phone ?? "",
    dateOfBirth: body.dateOfBirth ?? "",
    gender: body.gender ?? "",
    address: body.address ?? "",
    emergencyContact: body.emergencyContact ?? "",
  });

  const validationError = validatePatientRegistrationFields(fields);
  if (validationError) {
    throw new HttpError(400, validationError);
  }

  return {
    userId,
    ...fields,
  };
}

export async function POST(req: Request) {
  try {
    const body = assertRegisterPayload(await req.json());
    const supabase = getSupabaseAdmin();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, email")
      .eq("id", body.userId)
      .maybeSingle<{ id: string; role: string; email: string }>();

    if (profileError) throw profileError;
    if (!profile) throw new HttpError(404, "Newly created account was not found.");
    if (profile.role !== "patient") {
      throw new HttpError(400, "Only patient self-registration is supported here.");
    }
    if (profile.email.toLowerCase() !== body.email) {
      throw new HttpError(400, "Registration email does not match the created account.");
    }

    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        full_name: body.fullName,
        phone: body.phone,
        role: "patient",
        is_active: true,
      })
      .eq("id", body.userId);
    if (updateProfileError) throw updateProfileError;

    const { error: upsertPatientError } = await supabase
      .from("patients")
      .upsert({
        id: body.userId,
        dob: body.dateOfBirth,
        gender: body.gender,
        address: body.address,
        emergency_contact: body.emergencyContact,
      });
    if (upsertPatientError) throw upsertPatientError;

    return ok({ success: true }, 201);
  } catch (e) {
    return httpError(e);
  }
}
