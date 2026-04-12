"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { RoleProvider, useRole } from "./RoleProvider";
import { canAccessPath, getRoleProfile } from "@/src/lib/roles";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <RoleProvider>
      <DashboardShell>{children}</DashboardShell>
    </RoleProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { role, user, isLoading, signOut } = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const profile = getRoleProfile(role);
  const hasAccess = canAccessPath(role, pathname);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!hasAccess) {
      router.replace("/unauthorized");
    }
  }, [hasAccess, isLoading, router, user]);

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          Loading secure workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="relative min-h-[100svh] bg-slate-50">
      <Sidebar
        role={role}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-teal-200 bg-white/85 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-teal-300 bg-white p-2 text-teal-600 shadow-sm hover:bg-teal-50 lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                ≡
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Clinic Management System
                </p>
                <h2 className="text-lg font-bold text-slate-900">Operations Dashboard</h2>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="hidden w-64 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none ring-teal-200 transition placeholder:text-slate-400 focus:ring lg:block"
                placeholder="Search patient, invoice, doctor..."
                aria-label="Search"
              />

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Signed In As
                </p>
                <p className="text-sm font-medium text-slate-800">{user.email}</p>
              </div>

              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                type="button"
              >
                Alerts
              </button>

              <div className="flex items-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white">
                <span>{profile.shortLabel}</span>
                <span className="hidden sm:inline">{profile.label}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
