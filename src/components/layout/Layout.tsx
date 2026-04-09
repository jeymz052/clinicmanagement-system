"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";

type LayoutProps = {
  children: React.ReactNode;
  role?: "SUPER_ADMIN" | "ADMIN" | "DOCTOR" | "PATIENT";
};

export default function Layout({ children, role = "ADMIN" }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-[100svh] bg-slate-50">
      <Sidebar
        role={role}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-teal-200 bg-white/85 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-teal-300 bg-white p-2 text-teal-600 shadow-sm hover:bg-teal-50 lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                ☰
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Clinic Management System
                </p>
                <h2 className="text-lg font-bold text-slate-900">Operations Dashboard</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                className="hidden w-64 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none ring-teal-200 transition placeholder:text-slate-400 focus:ring sm:block"
                placeholder="Search patient, invoice, doctor..."
                aria-label="Search"
              />
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                type="button"
              >
                Alerts
              </button>
              <div className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white">
                AD
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
