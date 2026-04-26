"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowRightFromBracket,
  FaBars,
  FaBell,
  FaChevronDown,
  FaGear,
  FaRegUser,
} from "react-icons/fa6";
import { canAccessPath, getRoleProfile, type UserRole } from "@/src/lib/roles";

type ProfileShape = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type NotificationItem = {
  id: string;
  channels: Array<"email" | "sms">;
  template: string;
  status: "queued" | "sent" | "failed";
  created_at: string;
  send_at: string;
  sent_at: string | null;
  subject: string;
  body: string;
};

type DashboardHeaderProps = {
  role: UserRole;
  profile: ProfileShape | null;
  accessToken: string | null;
  onOpenSidebar: () => void;
  onLogout: () => Promise<void>;
};

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/appointments": "Appointments",
  "/appointments/list": "Appointment List",
  "/appointments/calendar": "Appointment Calendar",
  "/appointments/my": "My Appointments",
  "/patients": "Patients",
  "/patients/add": "Add Patient",
  "/patients/records": "Patient Records",
  "/consultations": "Consultations",
  "/consultations/history": "Consultation History",
  "/payments": "Payments",
  "/payments/history": "Payment History",
  "/payments/pos": "POS Billing",
  "/pricing": "Pricing",
  "/reports": "Reports",
  "/schedules": "Schedules",
  "/schedules/slots": "Time Slots",
  "/settings": "Settings",
  "/profile": "Profile",
  "/help": "Help Center",
  "/users": "Users",
};

function getInitials(name: string | null | undefined) {
  const value = name?.trim();
  if (!value) return "CU";
  const parts = value.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CU";
}

function getCompactName(name: string | null | undefined) {
  const value = name?.trim();
  if (!value) return "User";
  const [first, second] = value.split(/\s+/);
  if (!first) return "User";
  return second ? `${first} ${second[0]?.toUpperCase() ?? ""}.` : first;
}

function formatRelativeDate(input: string) {
  const value = new Date(input);
  const diffMinutes = Math.round((Date.now() - value.getTime()) / 60000);

  if (Math.abs(diffMinutes) < 1) return "Just now";
  if (Math.abs(diffMinutes) < 60) return `${Math.abs(diffMinutes)} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)} hr ago`;

  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function mapTemplateToLabel(template: string) {
  switch (template) {
    case "welcome":
      return "Registration";
    case "appointment_booked":
      return "Appointment Booking";
    case "appointment_confirmed":
      return "Appointment Approval";
    case "appointment_payment_success":
    case "appointment_paid_and_confirmed":
      return "Payment Success";
    case "online_meeting_link":
      return "Online Meeting Link";
    case "appointment_payment_failed":
      return "Payment Issue";
    case "appointment_reminder_24h":
      return "24 Hours Before Appointment";
    case "appointment_reminder_6h":
      return "Appointment Reminder";
    case "billing_issued":
      return "Billing Notice";
    case "appointment_cancelled":
      return "Appointment Update";
    default:
      return "Notification";
  }
}

function formatChannels(channels: Array<"email" | "sms">) {
  if (channels.length === 0) return "in-app";
  return channels.join(" + ");
}

export function DashboardHeader({
  role,
  profile,
  accessToken,
  onOpenSidebar,
  onLogout,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notifMenuRef = useRef<HTMLDivElement | null>(null);

  const pageTitle = PAGE_TITLES[pathname] ?? "Workspace";
  const roleLabel = getRoleProfile(role).label.toUpperCase();
  const displayName = profile?.full_name ?? "CHIARA User";
  const compactName = getCompactName(displayName);
  const displayEmail = profile?.email ?? "";
  const initials = getInitials(displayName);
  const canSeeSettings = canAccessPath(role, "/settings");
  const notifCount = useMemo(
    () => items.filter((item) => item.status === "queued" || item.status === "sent").length,
    [items],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(target)) {
        setIsNotifOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!accessToken || !isNotifOpen) return;
    let active = true;

    void fetch("/api/v2/notifications", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load notifications.");
        return (await response.json()) as { notifications: NotificationItem[] };
      })
      .then((payload) => {
        if (!active) return;
        setItems(payload.notifications);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
      })
      .finally(() => {
        if (active) setIsNotifLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, isNotifOpen]);

  async function handleLogoutClick() {
    setIsMenuOpen(false);
    await onLogout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-[linear-gradient(180deg,#f6f7ef_0%,#ffffff_72%)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
          >
            <FaBars className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:block">CHIARA Workspace</p>
            <h1 className="truncate text-base font-bold text-slate-900 sm:text-xl">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-teal-200 hover:text-teal-700 sm:h-12 sm:w-12"
              aria-label="Notifications"
              onClick={() => {
                if (!isNotifOpen) {
                  setIsNotifLoading(true);
                }
                setIsNotifOpen((current) => !current);
                setIsMenuOpen(false);
              }}
            >
              <FaBell className="h-4 w-4" />
              {notifCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white sm:right-2 sm:top-2">
                  {Math.min(notifCount, 9)}
                </span>
              ) : null}
            </button>

            {isNotifOpen ? (
              <div className="absolute right-0 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
                <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">Notification Center</p>
                  <p className="mt-1 text-xs text-slate-500">In-app updates for your account activity.</p>
                </div>

                <div className="max-h-[24rem] overflow-y-auto">
                  {isNotifLoading ? (
                    <div className="space-y-3 p-5">
                      {[0, 1, 2].map((key) => (
                        <div key={key} className="rounded-2xl border border-slate-100 p-4">
                          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                          <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
                          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : items.length > 0 ? (
                    <div className="p-3">
                      {items.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-100 px-4 py-3 transition hover:border-teal-100 hover:bg-teal-50/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                                {mapTemplateToLabel(item.template)}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{item.subject}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.body}</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {formatChannels(item.channels)}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{formatRelativeDate(item.created_at)}</span>
                            <span className="font-medium uppercase tracking-[0.12em]">{item.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center text-sm text-slate-500">
                      No notifications yet.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              className="flex min-w-0 max-w-[12rem] items-center gap-2 rounded-[1.4rem] border-2 border-slate-900 bg-white px-2.5 py-1.5 text-left shadow-sm transition hover:border-teal-700 hover:shadow-md sm:max-w-none sm:gap-3 sm:rounded-[1.75rem] sm:px-3 sm:py-2 sm:pr-4"
              onClick={() => {
                setIsMenuOpen((current) => !current);
                setIsNotifOpen(false);
              }}
              aria-label="Open account menu"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-slate-900 bg-[radial-gradient(circle_at_top,#163b7a_0%,#0f2147_80%)] text-xs font-bold text-white sm:h-11 sm:w-11 sm:border-4 sm:text-sm">
                {initials}
              </div>

              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-extrabold uppercase tracking-[0.04em] text-slate-900">
                  {displayName}
                </p>
                <p className="truncate text-[11px] uppercase tracking-[0.18em] text-slate-500">{roleLabel}</p>
              </div>

              <div className="min-w-0 sm:hidden">
                <p className="max-w-[4.75rem] truncate text-[11px] font-extrabold uppercase tracking-[0.03em] text-slate-900">
                  {compactName}
                </p>
              </div>

              <FaChevronDown className={`h-3 w-3 shrink-0 text-slate-500 transition ${isMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isMenuOpen ? (
              <div className="absolute right-0 mt-3 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
                <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                  <p className="truncate text-sm font-bold uppercase tracking-[0.04em] text-slate-900">{displayName}</p>
                  <p className="truncate text-xs text-slate-500">{displayEmail}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{roleLabel}</p>
                </div>

                <div className="p-2">
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-teal-700"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <FaRegUser className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>

                  <Link
                    href={canSeeSettings ? "/settings" : "/profile"}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-teal-700"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <FaGear className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </div>

                <div className="border-t border-slate-100 p-2">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-rose-50 hover:text-rose-700"
                    onClick={handleLogoutClick}
                  >
                    <FaArrowRightFromBracket className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
