"use client";

import type { ReactNode } from "react";
import { FaBell, FaEnvelope, FaIdBadge, FaPhone, FaRegUser, FaShieldHeart } from "react-icons/fa6";
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

export default function ProfilePage() {
  const { role, profile, user, isLoading } = useRole();
  const roleProfile = getRoleProfile(role);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-72 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="h-72 animate-pulse rounded-3xl bg-slate-100" />
          <div className="h-72 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      </div>
    );
  }

  const fullName = profile?.full_name ?? user?.user_metadata?.full_name ?? "CHIARA User";
  const initials = getInitials(fullName);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.12),transparent_30%),linear-gradient(135deg,#0f172a_0%,#111827_45%,#134e4a_100%)] p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/70 bg-white/10 text-2xl font-bold backdrop-blur">
              {initials}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">Account Profile</p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{fullName}</h1>
              <p className="mt-1 text-sm uppercase tracking-[0.18em] text-teal-100">{roleProfile.label}</p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">Status</p>
            <p className="mt-2 text-lg font-semibold">{profile?.is_active ? "Active account" : "Inactive account"}</p>
            <p className="mt-1 text-sm text-white/75">Your account menu now lives in the upper-right corner of the dashboard.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <FaRegUser className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Personal Details</h2>
              <p className="text-sm text-slate-500">Profile details used across the dashboard header and account menu.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard icon={<FaIdBadge className="h-4 w-4" />} label="Full Name" value={fullName} />
            <InfoCard icon={<FaShieldHeart className="h-4 w-4" />} label="Role" value={roleProfile.label} />
            <InfoCard icon={<FaEnvelope className="h-4 w-4" />} label="Email" value={profile?.email ?? user?.email ?? "—"} />
            <InfoCard icon={<FaPhone className="h-4 w-4" />} label="Phone" value={profile?.phone ?? "No phone number saved"} />
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <FaBell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Notification System</h2>
              <p className="text-sm text-slate-500">The bell button now surfaces events created by your existing notifications module.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Channels</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge label="Email" />
                <Badge label="SMS" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Triggers</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge label="Registration" />
                <Badge label="Appointment Booking" />
                <Badge label="Appointment Approval" />
                <Badge label="24 Hours Before Appointment" />
                <Badge label="Payment Success" />
                <Badge label="Online Meeting Link" />
              </div>
            </div>
          </div>
        </section>
      </div>
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
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700">
      {label}
    </span>
  );
}
