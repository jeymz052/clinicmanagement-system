import type { UserRole } from "@/src/lib/roles";

type PermissionAction =
  | "appointments.read"
  | "appointments.create"
  | "appointments.manage"
  | "patients.read"
  | "patients.manage"
  | "consultations.read"
  | "consultations.manage"
  | "schedules.read"
  | "schedules.manage"
  | "settings.read"
  | "users.manage"
  | "payments.pos";

const PERMISSION_MAP: Record<PermissionAction, UserRole[]> = {
  "appointments.read": ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  "appointments.create": ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  "appointments.manage": ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  "patients.read": ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  "patients.manage": ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  "consultations.read": ["SUPER_ADMIN", "DOCTOR"],
  "consultations.manage": ["SUPER_ADMIN", "DOCTOR"],
  "schedules.read": ["SUPER_ADMIN", "DOCTOR"],
  "schedules.manage": ["SUPER_ADMIN", "DOCTOR"],
  "settings.read": ["SUPER_ADMIN", "DOCTOR"],
  "users.manage": ["SUPER_ADMIN", "DOCTOR"],
  "payments.pos": ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
};

export function hasPermission(role: UserRole, action: PermissionAction) {
  return PERMISSION_MAP[action].includes(role);
}
