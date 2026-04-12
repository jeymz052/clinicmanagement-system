import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import {
  createPersistedAppointment,
  markAppointmentPaid,
  readAppointments,
} from "@/src/lib/server/appointments-store";

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

export async function GET(request: Request) {
  const authenticatedUser = await authenticateRequest(request);

  if (!authenticatedUser || !hasPermission(authenticatedUser.role, "appointments.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const appointments = await readAppointments();

  return NextResponse.json({ appointments });
}

export async function POST(request: Request) {
  const authenticatedUser = await authenticateRequest(request);

  if (!authenticatedUser || !hasPermission(authenticatedUser.role, "appointments.create")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const result = await createPersistedAppointment(payload);

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

export async function PATCH(request: Request) {
  const authenticatedUser = await authenticateRequest(request);

  if (!authenticatedUser || !hasPermission(authenticatedUser.role, "payments.online")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as { appointmentId?: string; action?: string };

  if (payload.action !== "mark-paid" || !payload.appointmentId) {
    return NextResponse.json({ message: "Invalid appointment update request." }, { status: 400 });
  }

  const result = await markAppointmentPaid(payload.appointmentId);

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, appointments: result.appointments },
      { status: 400 },
    );
  }

  return NextResponse.json({
    message: result.message,
    appointment: result.appointment,
    appointments: result.appointments,
  });
}
