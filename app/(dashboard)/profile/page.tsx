"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  FaCircleCheck,
  FaEnvelope,
  FaIdBadge,
  FaPhone,
  FaRegUser,
  FaShieldHeart,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getRoleProfile } from "@/src/lib/roles";

function getInitials(name: string | null | undefined) {
  const value = name?.trim();
  if (!value) return "CU";
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getProfileCompletion(fields: Array<string | null | undefined>) {
  const completed = fields.filter((field) => Boolean(field?.trim())).length;
  return Math.round((completed / fields.length) * 100);
}

export default function ProfilePage() {
  const { role, profile, user, isLoading } = useRole();
  const roleProfile = getRoleProfile(role);
  const settingsHref = role === "PATIENT" ? "/profile/settings" : "/settings";
  const helpHref = role === "PATIENT" ? "/profile/help" : "/help";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-80 animate-pulse rounded-3xl bg-emerald-100/70" />
        <div className="h-80 animate-pulse rounded-[2rem] bg-emerald-100/70" />
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="h-[27rem] animate-pulse rounded-[2rem] bg-slate-100" />
          <div className="h-[27rem] animate-pulse rounded-[2rem] bg-slate-100" />
        </div>
      </div>
    );
  }

  const fullName = profile?.full_name ?? user?.user_metadata?.full_name ?? "CHIARA User";
  const initials = getInitials(fullName);
  const email = profile?.email ?? user?.email ?? "No email saved";
  const phone = profile?.phone ?? "No phone number saved";
  const accountState = profile?.is_active ? "Active account" : "Inactive account";
  const profileCompletion = getProfileCompletion([
    fullName,
    roleProfile.label,
    profile?.email ?? user?.email ?? "",
    profile?.phone ?? "",
  ]);

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,rgba(187,247,208,0.95),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(22,163,74,0.24),transparent_28%),linear-gradient(135deg,#f4fff7_0%,#dff7e7_36%,#0f3f2f_100%)] p-6 text-emerald-950 shadow-[0_24px_80px_rgba(22,101,52,0.16)] sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_66%)] lg:block" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-emerald-300/70 bg-white/55 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800 backdrop-blur">
              Profile Workspace
            </div>

            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(21,128,61,0.92),rgba(6,78,59,0.96))] text-3xl font-bold text-white shadow-[0_18px_40px_rgba(6,78,59,0.25)]">
                {initials}
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-900">Account Profile</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{fullName}</h1>
                <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-white/65 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-950">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  {roleProfile.label}
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-900/80 sm:text-base">
              A cleaner profile view focused on identity, access, and essential contact details. The previous notification panel has been removed to keep this screen calmer and easier to scan.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[30rem] xl:grid-cols-1">
            <HeroMetric
              eyebrow="Status"
              title={accountState}
              detail={profile?.is_active ? "Your access is enabled across the dashboard." : "Ask an administrator to reactivate this account."}
            />
            <HeroMetric
              eyebrow="Profile completion"
              title={`${profileCompletion}% ready`}
              detail="Complete contact details help patients and staff reach you faster."
            />
            <div className="rounded-[1.6rem] border border-white/30 bg-white/14 p-4 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/80">Quick actions</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Shortcut href={settingsHref} label="My Settings" />
                <Shortcut href={helpHref} label="Help Center" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-[2rem] border border-emerald-100 bg-white/95 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <FaRegUser className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Personal details</h2>
                <p className="text-sm text-slate-500">Core information used across the dashboard and account menu.</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <FaCircleCheck className="h-3.5 w-3.5" />
              Synced with your account
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard icon={<FaIdBadge className="h-4 w-4" />} label="Full name" value={fullName} />
            <InfoCard icon={<FaShieldHeart className="h-4 w-4" />} label="Role" value={roleProfile.label} />
            <InfoCard icon={<FaEnvelope className="h-4 w-4" />} label="Email" value={email} />
            <InfoCard icon={<FaPhone className="h-4 w-4" />} label="Phone" value={phone} />
          </div>
        </section>

        <section className="space-y-6">
          <aside className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f3fcf5_100%)] p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Account overview</p>
            <div className="mt-5 space-y-4">
              <SummaryRow label="Primary email" value={email} />
              <SummaryRow label="Role access" value={roleProfile.label} />
              <SummaryRow label="Phone status" value={profile?.phone ? "Available" : "Needs update"} />
              <SummaryRow label="Account state" value={accountState} />
            </div>
          </aside>

          <aside className="rounded-[2rem] border border-emerald-100 bg-slate-950 p-6 text-white shadow-[0_22px_50px_rgba(2,44,34,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Profile health</p>
            <h2 className="mt-3 text-2xl font-bold">{profileCompletion}% complete</h2>
            <p className="mt-3 text-sm leading-6 text-emerald-50/78">
              Keep your contact details current so appointment updates, billing references, and staff coordination stay accurate.
            </p>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#86efac_0%,#22c55e_55%,#16a34a_100%)]"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/35 bg-white/90 px-3.5 py-2 text-xs font-semibold text-emerald-900 transition hover:border-white hover:bg-white"
    >
      {label}
    </Link>
  );
}

function HeroMetric({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/35 bg-white/18 p-4 text-slate-950 backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-950/75">{eyebrow}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-900/75">{detail}</p>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf8_100%)] p-5">
      <div className="flex items-center gap-2 text-emerald-800">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-emerald-100 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
