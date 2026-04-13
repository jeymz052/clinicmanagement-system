"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { RoleProvider, useRole } from "./RoleProvider";
import { canAccessPath } from "@/src/lib/roles";

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

      <div className="lg:pl-56">
        {/* Mobile sidebar toggle */}
        <div className="sticky top-0 z-20 flex items-center px-4 py-2 lg:hidden bg-white border-b border-slate-200">
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            ≡
          </button>
        </div>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
