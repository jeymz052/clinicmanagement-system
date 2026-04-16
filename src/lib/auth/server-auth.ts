import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { UserRole } from "@/src/lib/roles";

export type AuthenticatedUser = {
  user: User;
  role: UserRole;
};

function isValidRole(value: unknown): value is UserRole {
  return (
    value === "SUPER_ADMIN" ||
    value === "SECRETARY" ||
    value === "DOCTOR" ||
    value === "PATIENT"
  );
}

function dbRoleToUiRole(dbRole: string | null | undefined): UserRole {
  switch (dbRole) {
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
      return "PATIENT";
  }
}

export function readRoleFromUser(user: User): UserRole {
  const role = user.app_metadata?.role;
  return isValidRole(role) ? role : "PATIENT";
}

export async function requireAuthenticatedUser(accessToken: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  // Source of truth = profiles.role. Falls back to user_metadata.role
  // if profile row is missing (e.g. trigger didn't fire).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string }>();

  const role: UserRole = profile?.role
    ? dbRoleToUiRole(profile.role)
    : readRoleFromUser(data.user);

  return { user: data.user, role } satisfies AuthenticatedUser;
}
