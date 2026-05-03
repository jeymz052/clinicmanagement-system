import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import {
  createPersistedAppointmentWithContext,
  readAppointments,
  type AppointmentFilter,
} from "@/src/lib/server/appointments-store";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

async function authenticateRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return null;
  }

  try {
    return await requireAuthenticatedUser(accessToken);
  } catch {
    return null;
  }
}

async function buildRoleFilter(
  user: { user: { id: string; email?: string }; role: string },
): Promise<AppointmentFilter | "empty"> {
  if (user.role === "PATIENT") {
    return { patientId: user.user.id };
  }
  if (user.role === "DOCTOR") {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", user.user.id)
      .maybeSingle<{ id: string }>();
    if (data) return { doctorId: data.id };
    // Doctor role but no doctor row — return empty result rather than a bogus UUID.
    return "empty";
  }
  return {};
}

export async function GET(request: Request) {
  const authenticatedUser = await authenticateRequest(request);

  if (!authenticatedUser || !hasPermission(authenticatedUser.role, "appointments.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const filter = await buildRoleFilter(authenticatedUser);
    if (filter === "empty") {
      return NextResponse.json({ appointments: [] });
    }
    const appointments = await readAppointments(filter);
    return NextResponse.json({ appointments });
  } catch (e) {
    console.error("[GET /api/appointments]", e);
    const err = e as { message?: string; hint?: string; details?: string; code?: string };
    const message =
      err?.message ??
      err?.details ??
      err?.hint ??
      (typeof e === "string" ? e : "Internal error");
    return NextResponse.json(
      { message, code: err?.code ?? null, hint: err?.hint ?? null, appointments: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authenticatedUser = await authenticateRequest(request);

  if (!authenticatedUser || !hasPermission(authenticatedUser.role, "appointments.create")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const result = await createPersistedAppointmentWithContext(payload, {
    actor: authenticatedUser,
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, appointments: result.appointments },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      message: result.message,
      appointment: result.appointment,
      appointments: result.appointments,
    },
    { status: 201 },
  );
}
