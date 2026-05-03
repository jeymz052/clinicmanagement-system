"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";

type RevenueReport = { online: number; clinic: number; total: number };
type NoShowReport = { doctor_id: string; total: number; no_shows: number; rate: number };
type PeakHourReport = { start_time: string; count: number };
type VolumeReport = { appointments: number; unique_patients: number };

type ReportsPayload = {
  revenue: RevenueReport;
  no_show: NoShowReport[];
  peak_hours: PeakHourReport[];
  volume: VolumeReport;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
}

function formatPercent(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default function ReportsPage() {
  const { accessToken, isLoading: authLoading } = useRole();
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayIso);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const url = new URL("/api/v2/reports", window.location.origin);
        url.searchParams.set("from", from);
        url.searchParams.set("to", to);
        const res = await fetch(url.toString(), {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load reports");
        const payload = (await res.json()) as ReportsPayload;
        if (active) {
          setData(payload);
          setError(null);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load reports");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading, from, to]);

  const peakMax = Math.max(1, ...(data?.peak_hours.map((h) => h.count) ?? [1]));

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,#f8fffb_0%,#effcf3_52%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(16,185,129,0.10)] animate-fade-in-down">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Reports & Analytics</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Clinic revenue, patient volume, and peak-hour insights</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Review total patients, revenue, no-show rate, and booking patterns without jumping between modules.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <QuickLink href="/payments" label="Payments" />
            <QuickLink href="/patients" label="Patients" />
            <QuickLink href="/appointments/list" label="Appointments" />
            <QuickLink href="/dashboard" label="Overview" />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-1">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Date Range</p>
            <p className="mt-1 text-sm text-slate-600">Filter the analytics window to match what you need to review.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-slate-500">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-full border border-emerald-100 bg-white px-3 py-2 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
            <label className="text-slate-500">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-full border border-emerald-100 bg-white px-3 py-2 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-up stagger-1">
          <StatCard label="Total Revenue" value={loading ? "…" : formatMoney(data?.revenue.total ?? 0)} hint="Clinic + Online" tone="teal" />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <StatCard label="Clinic Revenue" value={loading ? "…" : formatMoney(data?.revenue.clinic ?? 0)} hint="POS collections" tone="emerald" />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <StatCard label="Online Revenue" value={loading ? "…" : formatMoney(data?.revenue.online ?? 0)} hint="Advance payments" tone="sky" />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <StatCard label="Appointments" value={loading ? "…" : String(data?.volume.appointments ?? 0)} hint={`${data?.volume.unique_patients ?? 0} unique patients`} tone="amber" />
        </div>
      </div>

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-5">
        <h2 className="text-lg font-bold text-slate-900">Peak Hours</h2>
        <p className="text-xs text-slate-500 mt-0.5">Booking count per hour (excluding cancelled)</p>
        {loading ? (
          <div className="mt-6 h-64 rounded-lg bg-slate-50 animate-pulse" />
        ) : (data?.peak_hours.length ?? 0) === 0 ? (
          <p className="mt-6 text-sm text-slate-400">No bookings yet.</p>
        ) : (
          <div className="mt-6 grid h-64 items-end gap-2 rounded-lg bg-slate-50 p-4" style={{ gridTemplateColumns: `repeat(${data?.peak_hours.length}, minmax(0, 1fr))` }}>
            {data?.peak_hours
              .slice()
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((h) => {
                const pct = Math.round((h.count / peakMax) * 100);
                return (
                  <div key={h.start_time} className="relative h-full flex flex-col items-center justify-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-teal-700 to-teal-400"
                      style={{ height: `${pct}%` }}
                      title={`${h.start_time} — ${h.count} appointments`}
                    />
                    <span className="text-[10px] text-slate-500 mt-1">{h.start_time}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-6">
        <h2 className="text-lg font-bold text-slate-900">No-show Rate by Doctor</h2>
        <p className="text-xs text-slate-500 mt-0.5">Share of completed-or-missed appointments that were missed</p>
        {loading ? (
          <div className="mt-6 h-24 rounded-lg bg-slate-50 animate-pulse" />
        ) : (data?.no_show.length ?? 0) === 0 ? (
          <p className="mt-6 text-sm text-slate-400">No completed consultations yet.</p>
        ) : (
          <div className="mt-6 divide-y divide-slate-100">
            {data?.no_show.map((r) => (
              <div key={r.doctor_id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">Doctor {r.doctor_id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">
                    {r.no_shows} no-show{r.no_shows === 1 ? "" : "s"} of {r.total}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    r.rate >= 0.2
                      ? "bg-red-50 text-red-700"
                      : r.rate >= 0.1
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {formatPercent(r.rate)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "teal",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "teal" | "emerald" | "sky" | "amber";
}) {
  const accent = {
    teal: "bg-teal-500",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
  };
  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
      <div className={`absolute -top-4 -right-4 h-16 w-16 rounded-full opacity-10 ${accent[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-emerald-100 bg-white px-4 py-2.5 text-center text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
    >
      {label}
    </Link>
  );
}
