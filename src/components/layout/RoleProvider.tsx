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
  const metadataRole = user?.user_metadata?.role;
  return isValidRole(metadataRole) ? metadataRole : DEFAULT_ROLE;
}

function isValidRole(value: unknown): value is UserRole {
  return (
    value === "SUPER_ADMIN" ||
    value === "SECRETARY" ||
    value === "DOCTOR" ||
    value === "PATIENT"
  );
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(DEFAULT_ROLE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    void supabase.auth.getSession().then((result: { data: { session: Session | null }, error: any }) => {
      const { data, error } = result;
      if (!active) {
        return;
      }

      if (error) {
        setIsLoading(false);
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setRole(readRoleFromUser(data.session?.user ?? null));
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, nextSession: Session | null) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setRole(readRoleFromUser(nextSession?.user ?? null));
      setIsLoading(false);
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
