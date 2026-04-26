import type { User } from "@supabase/supabase-js";
import { resolveProtectedUiRole } from "@/src/lib/auth/protected-accounts";
import type { DbRole } from "@/src/lib/db/types";
import { DEFAULT_ROLE, type UserRole } from "@/src/lib/roles";

export function isValidUserRole(value: unknown): value is UserRole {
  return (
    value === "SUPER_ADMIN" ||
    value === "SECRETARY" ||
    value === "DOCTOR" ||
    value === "PATIENT"
  );
}

export function dbRoleToUiRole(dbRole: DbRole | string | null | undefined): UserRole | null {
  switch (dbRole?.toLowerCase()) {
    case "super_admin":
    case "admin":
      return "SUPER_ADMIN";
    case "secretary":
      return "SECRETARY";
    case "doctor":
      return "DOCTOR";
    case "patient":
      return "PATIENT";
    default:
      return null;
  }
}

export function roleToUiRole(rawRole: unknown): UserRole | null {
  if (isValidUserRole(rawRole)) return rawRole;
  if (typeof rawRole !== "string") return null;
  return dbRoleToUiRole(rawRole);
}

export function readRoleFromUserMetadata(user: User | null): UserRole | null {
  return resolveProtectedUiRole(roleToUiRole(user?.app_metadata?.role), user?.email);
}

export function resolveUiRoleOrDefault(
  rawRole: unknown,
  email: string | null | undefined,
): UserRole {
  return resolveProtectedUiRole(roleToUiRole(rawRole), email) ?? DEFAULT_ROLE;
}