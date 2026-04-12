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

export function readRoleFromUser(user: User): UserRole {
  const role = user.user_metadata?.role;
  return isValidRole(role) ? role : "PATIENT";
}

export async function requireAuthenticatedUser(accessToken: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  return {
    user: data.user,
    role: readRoleFromUser(data.user),
  } satisfies AuthenticatedUser;
}
