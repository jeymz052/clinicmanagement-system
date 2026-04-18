"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { DEFAULT_ROLE, type UserRole } from "@/src/lib/roles";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";

type RoleContextValue = {
  role: UserRole;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  accessToken: string | null;
  signOut: () => Promise<void>;
};

const RoleContext = createContext<RoleContextValue | null>(null);

function readRoleFromUser(user: User | null): UserRole {
  return roleToUiRole(user?.app_metadata?.role) ?? DEFAULT_ROLE;
}

function isValidRole(value: unknown): value is UserRole {
  return (
    value === "SUPER_ADMIN" ||
    value === "SECRETARY" ||
    value === "DOCTOR" ||
    value === "PATIENT"
  );
}

function dbRoleToUiRole(dbRole: string | null | undefined): UserRole {
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
      return DEFAULT_ROLE;
  }
}

function roleToUiRole(rawRole: unknown): UserRole | null {
  if (isValidRole(rawRole)) return rawRole;
  if (typeof rawRole !== "string") return null;
  return dbRoleToUiRole(rawRole);
}

async function fetchRoleFromApi(accessToken: string): Promise<UserRole | null> {
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch("/api/v2/me", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as { profile?: { role?: string } };
      const parsedRole = roleToUiRole(payload.profile?.role);
      if (parsedRole) return parsedRole;
    } catch {
      // Network timeouts can happen in local dev; retry briefly before fallback.
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }

  return null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(DEFAULT_ROLE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function applySession(nextSession: Session | null) {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        // Optimistic role from metadata, then refine from profiles table
        setRole(readRoleFromUser(nextSession.user));
        const dbRole = await fetchRoleFromApi(nextSession.access_token);
        if (!active) return;
        if (dbRole) setRole(dbRole);
      } else {
        setRole(DEFAULT_ROLE);
      }
      setIsLoading(false);
    }

    void supabase.auth.getSession().then((result: { data: { session: Session | null }, error: unknown }) => {
      const { data, error } = result;
      if (!active) return;
      if (error) {
        setIsLoading(false);
        return;
      }
      void applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, nextSession: Session | null) => {
      void applySession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  }

  return (
    <RoleContext.Provider
      value={{
        role,
        session,
        user,
        isLoading,
        accessToken: session?.access_token ?? null,
        signOut,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);

  if (!context) {
    throw new Error("useRole must be used within RoleProvider.");
  }

  return context;
}
