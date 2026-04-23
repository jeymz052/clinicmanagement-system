import { HttpError, httpError, ok } from "@/src/lib/http";
import {
  normalizePatientRegistrationFields,
  validatePatientRegistrationFields,
  type PatientRegistrationFields,
} from "@/src/lib/patient-registration";
import { isProtectedSuperAdminEmail } from "@/src/lib/auth/protected-accounts";
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
  });

  const validationError = validatePatientRegistrationFields(fields);
  if (validationError) {
    throw new HttpError(400, validationError);
  }
  if (isProtectedSuperAdminEmail(fields.email)) {
    throw new HttpError(400, "This email is reserved for the super admin account.");
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

    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(body.userId);
    if (authUserError) throw authUserError;
    if (!authUser.user) {
      throw new HttpError(404, "Newly created account was not found.");
    }

    const authEmail = authUser.user.email?.trim().toLowerCase();
    if (!authEmail) {
      throw new HttpError(400, "Newly created account is missing an email address.");
    }
    if (authEmail !== body.email) {
      throw new HttpError(400, "Registration email does not match the created account.");
    }

    const existingAppMetadata =
      authUser.user.app_metadata && typeof authUser.user.app_metadata === "object"
        ? authUser.user.app_metadata
        : {};
    const existingUserMetadata =
      authUser.user.user_metadata && typeof authUser.user.user_metadata === "object"
        ? authUser.user.user_metadata
        : {};

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(body.userId, {
      app_metadata: {
        ...existingAppMetadata,
        role: "patient",
      },
      user_metadata: {
        ...existingUserMetadata,
        full_name: body.fullName,
        phone: body.phone,
        dob: body.dateOfBirth,
        gender: body.gender,
        address: body.address,
      },
    });
    if (updateAuthError) throw updateAuthError;

    const { error: upsertProfileError } = await supabase.from("profiles").upsert({
      id: body.userId,
      email: body.email,
      full_name: body.fullName,
      phone: body.phone,
      role: "patient",
      is_active: true,
    });
    if (upsertProfileError) throw upsertProfileError;

    const { error: upsertPatientError } = await supabase
      .from("patients")
      .upsert({
        id: body.userId,
        dob: body.dateOfBirth,
        gender: body.gender,
        address: body.address,
      });
    if (upsertPatientError) throw upsertPatientError;

    return ok({ success: true }, 201);
  } catch (e) {
    return httpError(e);
  }
}
