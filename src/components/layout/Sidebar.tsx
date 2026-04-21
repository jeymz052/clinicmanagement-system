"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { IconType } from "react-icons";
import {
  FaCalendarCheck,
  FaCalendarDays,
  FaCalendarPlus,
  FaChartLine,
  FaChevronRight,
  FaCircleCheck,
  FaClock,
  FaClockRotateLeft,
  FaCircleQuestion,
  FaCreditCard,
  FaFileLines,
  FaGear,
  FaHouse,
  FaListUl,
  FaRegMessage,
  FaStethoscope,
  FaUsers,
  FaVideo,
} from "react-icons/fa6";
import type { UserRole } from "@/src/lib/roles";

type NavSubItem = {
  label: string;
  href: string;
  icon: IconType;
};

type NavItem = {
  label: string;
  href: string;
  icon: IconType;
  subItems?: NavSubItem[];
};

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    { label: "Users", href: "/users", icon: FaUsers },
    {
      label: "Patients",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "All Patients", href: "/patients", icon: FaUsers },
        { label: "Patient Records", href: "/patients/records", icon: FaFileLines },
      ],
    },
    {
      label: "Appointments",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments", icon: FaCalendarPlus },
        { label: "Appointment List", href: "/appointments/list", icon: FaListUl },
        { label: "Calendar View", href: "/appointments/calendar", icon: FaCalendarDays },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Online Payment", href: "/payments", icon: FaCreditCard },
        { label: "POS Billing", href: "/payments/pos", icon: FaFileLines },
      ],
    },
    {
      label: "Consultations",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Online Consultation", href: "/consultations", icon: FaVideo },
        { label: "Consultation History", href: "/consultations/history", icon: FaClockRotateLeft },
      ],
    },
    {
      label: "Schedules",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "Doctor Schedules", href: "/schedules", icon: FaStethoscope },
        { label: "Time Slots", href: "/schedules/slots", icon: FaClock },
      ],
    },
    { label: "Pricing", href: "/pricing", icon: FaCreditCard },
    { label: "Reports", href: "/reports", icon: FaChartLine },
    { label: "Settings", href: "/settings", icon: FaGear },
    { label: "Help Center", href: "/help", icon: FaCircleQuestion },
  ],
  SECRETARY: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    {
      label: "Patients",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "All Patients", href: "/patients", icon: FaUsers },
        { label: "Patient Records", href: "/patients/records", icon: FaFileLines },
      ],
    },
    {
      label: "Appointments",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments", icon: FaCalendarPlus },
        { label: "Appointment List", href: "/appointments/list", icon: FaListUl },
        { label: "Calendar View", href: "/appointments/calendar", icon: FaCalendarDays },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Online Payment", href: "/payments", icon: FaCreditCard },
        { label: "POS Billing", href: "/payments/pos", icon: FaFileLines },
      ],
    },
    {
      label: "Schedules",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "Doctor Schedules", href: "/schedules", icon: FaStethoscope },
        { label: "Time Slots", href: "/schedules/slots", icon: FaClock },
      ],
    },
    { label: "Pricing", href: "/pricing", icon: FaCreditCard },
    { label: "Reports", href: "/reports", icon: FaChartLine },
    { label: "Settings", href: "/settings", icon: FaGear },
  ],
  DOCTOR: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    {
      label: "Appointments",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Manage Appointments", href: "/appointments", icon: FaCalendarCheck },
        { label: "Appointment List", href: "/appointments/list", icon: FaListUl },
        { label: "Calendar View", href: "/appointments/calendar", icon: FaCalendarDays },
      ],
    },
    {
      label: "Patients",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "My Patients", href: "/patients", icon: FaUsers },
        { label: "Patient Records", href: "/patients/records", icon: FaFileLines },
      ],
    },
    {
      label: "Consultations",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Start Online Consultation", href: "/consultations", icon: FaVideo },
        { label: "Consultation History", href: "/consultations/history", icon: FaClockRotateLeft },
      ],
    },
    {
      label: "Schedules",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "My Schedule", href: "/schedules", icon: FaStethoscope },
        { label: "Unavailable Dates", href: "/schedules/slots", icon: FaClock },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Online Payment", href: "/payments", icon: FaCreditCard },
        { label: "POS Billing", href: "/payments/pos", icon: FaFileLines },
      ],
    },
    { label: "Pricing", href: "/pricing", icon: FaCreditCard },
    { label: "Reports", href: "/reports", icon: FaChartLine },
    { label: "Settings", href: "/settings", icon: FaGear },
  ],
  PATIENT: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    {
      label: "Appointments",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments", icon: FaCalendarPlus },
        { label: "My Appointments", href: "/appointments/my", icon: FaCalendarCheck },
        { label: "Calendar View", href: "/appointments/calendar", icon: FaCalendarDays },
      ],
    },
    {
      label: "Consultations",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Online Consultation", href: "/consultations", icon: FaVideo },
        { label: "Consultation History", href: "/consultations/history", icon: FaClockRotateLeft },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [{ label: "Pay Online", href: "/payments", icon: FaCreditCard }],
    },
    {
      label: "Patients",
      href: "/patients",
      icon: FaUsers,
      subItems: [{ label: "My Records", href: "/patients/records", icon: FaFileLines }],
    },
  ],
};

type SidebarProps = {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
};

type ExpandedMenus = Record<string, boolean>;

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const navItems = NAV_BY_ROLE[role];
  const pathname = usePathname();
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const [expanded, setExpanded] = useState<ExpandedMenus>(
    Object.fromEntries(navItems.map((item) => [item.label, false])),
  );

  const toggleExpand = (label: string) => {
    setExpanded((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm lg:hidden ${
          isOpen ? "block" : "hidden"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed left-0 top-0 z-40 flex h-[100svh] max-h-[100svh] w-56 flex-col overflow-hidden border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 lg:h-screen lg:max-h-screen lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2">
          <div className="flex items-center justify-between">
            <Image
              src="/images/chiaralogo.png"
              alt="Chiara Logo"
              width={669}
              height={373}
              priority
              quality={100}
              style={{ width: "180px", height: "auto" }}
              className="object-contain -my-2"
            />
            <button
              className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
              onClick={onClose}
              type="button"
              aria-label="Close sidebar"
            >
              x
            </button>
          </div>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="flex flex-col gap-2.5">
            {navItems.map((item) => {
              const itemActive = isActive(item.href);

              return (
                <div key={item.label} className="min-h-0">
                  <div
                    className={`group flex items-center rounded-xl px-2 py-2 transition-colors duration-150 ${
                      itemActive ? "bg-teal-50" : "hover:bg-slate-100"
                    }`}
                  >
                    <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-2">
                      <item.icon
                        className={`h-4 w-4 shrink-0 ${
                          itemActive ? "text-teal-600" : "text-slate-400 group-hover:text-teal-600"
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`truncate text-[15px] leading-4 ${
                          itemActive
                            ? "font-semibold text-teal-700"
                            : "font-medium text-slate-700 group-hover:text-teal-700"
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>

                    {item.subItems ? (
                      <button
                        type="button"
                        className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-teal-600"
                        onClick={() => toggleExpand(item.label)}
                        aria-label={`Toggle ${item.label} submenu`}
                      >
                        <FaChevronRight
                          className={`h-2.5 w-2.5 transition-transform duration-200 ${
                            expanded[item.label] ? "rotate-90" : "rotate-0"
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}
                  </div>

                  {item.subItems && expanded[item.label] ? (
                    <div className="ml-6 mt-1 space-y-1 border-l border-slate-200 pl-2">
                      {item.subItems.map((subItem) => {
                        const subItemActive = isActive(subItem.href);

                        return (
                          <Link
                            key={subItem.label}
                            href={subItem.href}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium leading-4 transition ${
                              subItemActive
                                ? "bg-teal-50 text-teal-700"
                                : "text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                            }`}
                          >
                            <subItem.icon
                              className={`h-3.5 w-3.5 shrink-0 ${
                                subItemActive ? "text-teal-600" : "text-slate-400"
                              }`}
                              aria-hidden="true"
                            />
                            <span className="truncate">{subItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
          <div className="rounded-2xl border border-emerald-800/80 bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 px-3 py-3 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
                Clinic Status
              </span>
              <FaCircleCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            </div>

            <div className="mt-2 text-center">
              <p className="text-xl font-semibold leading-none text-white">Open Today</p>
            </div>

            <div className="mt-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2">
              <div className="flex items-center justify-center gap-2 text-emerald-50">
                <FaClock className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold">8:00 AM - 5:00 PM</span>
              </div>
              <p className="mt-1 text-center text-[10px] text-emerald-100/75">{todayLabel}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
