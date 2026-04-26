import type { User } from "@supabase/supabase-js";
import {
  dbRoleToUiRole,
  readRoleFromUserMetadata,
} from "@/src/lib/auth/role-mappings";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { UserRole } from "@/src/lib/roles";
import { resolveProtectedUiRole } from "@/src/lib/auth/protected-accounts";

export type AuthenticatedUser = {
  user: User;
  role: UserRole;
};

export function readRoleFromUser(user: User): UserRole {
return readRoleFromUserMetadata(user) ?? "PATIENT";
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
    .select("role, email")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string; email: string }>();

  const role: UserRole = resolveProtectedUiRole(
    profile?.role ? dbRoleToUiRole(profile.role) : readRoleFromUser(data.user),
    profile?.email ?? data.user.email,
  ) ?? "PATIENT";

  return { user: data.user, role } satisfies AuthenticatedUser;
}
