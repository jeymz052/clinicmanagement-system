"use server";

import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import {
  createPersistedAppointmentWithContext,
  deletePersistedAppointment,
  markClinicAppointmentComplete,
  readAppointments,
  updatePersistedAppointment,
  type AppointmentCreatePayload,
  type AppointmentUpdatePayload,
} from "@/src/lib/server/appointments-store";

async function unauthorized(message: string) {
  return {
    ok: false as const,
    message,
    appointments: await readAppointments(),
  };
}

export async function createAppointmentAction(
  accessToken: string,
  payload: AppointmentCreatePayload,
) {
  const authenticatedUser = await requireAuthenticatedUser(accessToken);

  if (!hasPermission(authenticatedUser.role, "appointments.create")) {
    return unauthorized("You are not allowed to create appointments.");
  }

  return createPersistedAppointmentWithContext(payload, {
    actor: authenticatedUser,
  });
}

export async function updateAppointmentAction(
  accessToken: string,
  payload: AppointmentUpdatePayload,
) {
  const authenticatedUser = await requireAuthenticatedUser(accessToken);

  if (!hasPermission(authenticatedUser.role, "appointments.manage")) {
    return unauthorized("You are not allowed to update appointments.");
  }

  return updatePersistedAppointment(payload);
}

export async function deleteAppointmentAction(accessToken: string, appointmentId: string) {
  const authenticatedUser = await requireAuthenticatedUser(accessToken);

  if (!hasPermission(authenticatedUser.role, "appointments.manage")) {
    return unauthorized("You are not allowed to delete appointments.");
  }

  return deletePersistedAppointment(appointmentId);
}

export async function markClinicPosPaidAction(accessToken: string, appointmentId: string) {
  const authenticatedUser = await requireAuthenticatedUser(accessToken);

  if (!hasPermission(authenticatedUser.role, "payments.pos")) {
    return unauthorized("You are not allowed to settle clinic POS payments.");
  }

  return markClinicAppointmentComplete(appointmentId);
}
