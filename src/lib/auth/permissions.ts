import type { UserRole } from "@/src/lib/roles";

type PermissionAction =
  | "appointments.read"
  | "appointments.create"
  | "appointments.manage"
  | "payments.online"
  | "payments.pos";

const PERMISSION_MAP: Record<PermissionAction, UserRole[]> = {
  "appointments.read": ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  "appointments.create": ["SUPER_ADMIN", "SECRETARY", "PATIENT"],
  "appointments.manage": ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  "payments.online": ["SUPER_ADMIN", "SECRETARY", "PATIENT"],
  "payments.pos": ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
};

export function hasPermission(role: UserRole, action: PermissionAction) {
  return PERMISSION_MAP[action].includes(role);
}
