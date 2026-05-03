import { NextResponse } from "next/server";
import type { DbRole, Profile } from "@/src/lib/db/types";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { resolveProtectedDbRole } from "@/src/lib/auth/protected-accounts";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function ok<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}

export function httpError(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ message: e.message }, { status: e.status });
  }
  const message =
    e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Internal error";
  const isUnique = message.includes("duplicate key") || message.includes("unique");
  const isExclusion = message.includes("conflicting key") || message.includes("exclusion");
  if (isUnique || isExclusion) {
    return NextResponse.json(
      { message: "Conflict — slot taken or overlaps another booking." },
      { status: 409 },
    );
  }
  console.error("[api]", e);
  return NextResponse.json({ message: "Internal error" }, { status: 500 });
}

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length) || null;
}

export type Actor = {
  id: string;
  profile: Profile;
};

export async function getActor(req: Request): Promise<Actor | null> {
  const token = extractBearer(req);
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  if (!data.user.email_confirmed_at) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single<Profile>();
  if (profileError || !profile) return null;
  if (!profile.is_active) return null;

  const normalizedProfile: Profile = {
    ...profile,
    role: resolveProtectedDbRole(profile.role, profile.email) as DbRole,
  };

  return { id: normalizedProfile.id, profile: normalizedProfile };
}

export async function requireActor(req: Request): Promise<Actor> {
  const actor = await getActor(req);
  if (!actor) throw new HttpError(401, "Unauthenticated");
  return actor;
}

export async function requireRole(req: Request, allow: DbRole[]): Promise<Actor> {
  const actor = await requireActor(req);
  if (!allow.includes(actor.profile.role)) {
    throw new HttpError(403, "Forbidden");
  }
  return actor;
}

export const STAFF_ROLES: DbRole[] = ["admin", "secretary", "super_admin"];

export function isStaff(role: DbRole) {
  return STAFF_ROLES.includes(role);
}
