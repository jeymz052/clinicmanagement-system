"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { DEFAULT_ROLE, type UserRole } from "@/src/lib/roles";
import {
  roleToUiRole,
  readRoleFromUserMetadata,
} from "@/src/lib/auth/role-mappings";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";
import { resolveProtectedUiRole } from "@/src/lib/auth/protected-accounts";

type UserProfile = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RoleContextValue = {
  role: UserRole;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  accessToken: string | null;
  signOut: () => Promise<void>;
};

const RoleContext = createContext<RoleContextValue | null>(null);

function readRoleFromUser(user: User | null): UserRole {
  return readRoleFromUserMetadata(user) ?? DEFAULT_ROLE;
}

function isEmailVerified(user: User | null) {
  return Boolean(user?.email_confirmed_at);
}

async function fetchProfileFromApi(accessToken: string): Promise<UserProfile | null> {
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch("/api/v2/me", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as { profile?: UserProfile | null };
      const nextProfile = payload.profile;
      const parsedRole = resolveProtectedUiRole(
        roleToUiRole(nextProfile?.role),
        nextProfile?.email,
      );
      if (nextProfile && parsedRole) {
        return {
          ...nextProfile,
          role: parsedRole,
        };
      }
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function applySession(nextSession: Session | null) {
      const requestId = ++requestSequenceRef.current;
      if (!active) return;
      setSession(nextSession);
      setUser(isEmailVerified(nextSession?.user ?? null) ? nextSession?.user ?? null : null);
      setIsLoading(true);

      if (nextSession?.user && isEmailVerified(nextSession.user)) {
        const optimisticRole = readRoleFromUserMetadata(nextSession.user);
        if (optimisticRole) {
          setRole(optimisticRole);
        }

        const dbProfile = await fetchProfileFromApi(nextSession.access_token);
        if (!active || requestId !== requestSequenceRef.current) return;

        if (dbProfile) {
          setProfile(dbProfile);
          setRole(
            resolveProtectedUiRole(roleToUiRole(dbProfile.role), dbProfile.email)
            ?? optimisticRole
            ?? readRoleFromUser(nextSession.user),
          );
        } else {
          setProfile(null);
          setRole(optimisticRole ?? readRoleFromUser(nextSession.user));
        }
      } else {
        if (nextSession?.user && !isEmailVerified(nextSession.user)) {
          await supabase.auth.signOut();
        }
        setRole(DEFAULT_ROLE);
        setProfile(null);
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
        profile,
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
