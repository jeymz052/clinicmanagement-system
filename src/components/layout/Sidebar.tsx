"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { IconType } from "react-icons";
import {
  FaArrowRightFromBracket,
  FaCalendarCheck,
  FaChartLine,
  FaChevronRight,
  FaCircleQuestion,
  FaCreditCard,
  FaGear,
  FaHouse,
  FaRegMessage,
  FaRegUser,
  FaShieldHalved,
  FaStethoscope,
  FaUsers,
} from "react-icons/fa6";
import { getRoleProfile, type UserRole } from "@/src/lib/roles";

type NavSubItem = {
  label: string;
  href: string;
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
    {
      label: "Patients",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "All Patients", href: "/patients" },
        { label: "Add Patient", href: "/patients/add" },
        { label: "Patient Records", href: "/patients/records" },
      ],
    },
    {
      label: "Appointments",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments" },
        { label: "Appointment List", href: "/appointments/list" },
        { label: "Calendar View", href: "/appointments/calendar" },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Online Payment", href: "/payments" },
        { label: "POS Billing", href: "/payments/pos" },
        { label: "Invoices", href: "/payments/invoices" },
      ],
    },
    {
      label: "Consultations",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Online Consultation", href: "/consultations" },
        { label: "Consultation History", href: "/consultations/history" },
      ],
    },
    {
      label: "Schedules",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "Doctor Schedules", href: "/schedules" },
        { label: "Time Slots", href: "/schedules/slots" },
      ],
    },
    { label: "Reports", href: "/reports", icon: FaChartLine },
    { label: "Settings", href: "/settings", icon: FaGear },
    { label: "System Roles", href: "/settings", icon: FaShieldHalved },
    { label: "Help Center", href: "/help", icon: FaCircleQuestion },
  ],
  SECRETARY: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    {
      label: "Patients",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "All Patients", href: "/patients" },
        { label: "Add Walk-In", href: "/patients/add" },
        { label: "Patient Records", href: "/patients/records" },
      ],
    },
    {
      label: "Appointments",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments" },
        { label: "Appointment List", href: "/appointments/list" },
        { label: "Calendar View", href: "/appointments/calendar" },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Online Payment", href: "/payments" },
        { label: "POS Billing", href: "/payments/pos" },
        { label: "Invoices", href: "/payments/invoices" },
      ],
    },
    {
      label: "Schedules",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "Doctor Schedules", href: "/schedules" },
        { label: "Time Slots", href: "/schedules/slots" },
      ],
    },
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
        { label: "Manage Appointments", href: "/appointments" },
        { label: "Appointment List", href: "/appointments/list" },
        { label: "Calendar View", href: "/appointments/calendar" },
      ],
    },
    {
      label: "Patients",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "My Patients", href: "/patients" },
        { label: "Patient Records", href: "/patients/records" },
      ],
    },
    {
      label: "Consultations",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Start Online Consultation", href: "/consultations" },
        { label: "Consultation History", href: "/consultations/history" },
      ],
    },
    {
      label: "Schedules",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "My Schedule", href: "/schedules" },
        { label: "Unavailable Dates", href: "/schedules/slots" },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Online Payment", href: "/payments" },
        { label: "POS Billing", href: "/payments/pos" },
      ],
    },
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
        { label: "Book Appointment", href: "/appointments" },
        { label: "Calendar View", href: "/appointments/calendar" },
      ],
    },
    {
      label: "Consultations",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Online Consultation", href: "/consultations" },
        { label: "Consultation History", href: "/consultations/history" },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Pay Online", href: "/payments" },
        { label: "Invoices", href: "/payments/invoices" },
      ],
    },
    {
      label: "Patients",
      href: "/patients",
      icon: FaUsers,
      subItems: [{ label: "My Records", href: "/patients/records" }],
    },
  ],
};

type SidebarProps = {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
};

type ExpandedMenus = Record<string, boolean>;

function ChiaraLogo() {
  return (
    <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white text-teal-700 shadow-sm">
      <span className="text-base font-black leading-none">C</span>
      <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-600 text-[9px] font-bold text-white">
        +
      </span>
    </div>
  );
}

export function Sidebar({ role, isOpen, onClose, onLogout }: SidebarProps) {
  const navItems = NAV_BY_ROLE[role];
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<ExpandedMenus>(
    Object.fromEntries(navItems.map((item) => [item.label, true])),
  );
  const profile = getRoleProfile(role);

  const toggleExpand = (label: string) => {
    setExpanded((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

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
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChiaraLogo />
              <div>
                <h1 className="text-[1.65rem] font-extrabold leading-5 text-teal-700">Chiara</h1>
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400">
                  Clinic Management
                </p>
              </div>
            </div>

            <button
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={onClose}
              type="button"
              aria-label="Close sidebar"
            >
              ×
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-4 py-3 bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Active Role
          </p>
          <p className="mt-1 text-sm font-semibold text-teal-700">{profile.label}</p>
          <p className="mt-1 text-xs text-slate-400">{profile.description}</p>
        </div>

        <nav className="px-3 py-3">
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
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.label}
                          href={subItem.href}
                          className={`block rounded-md px-2 py-1 text-[13px] font-medium leading-4 transition ${
                            isActive(subItem.href)
                              ? "bg-teal-100 text-teal-700"
                              : "text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                          }`}
                        >
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <button
              type="button"
              className="group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-100"
              onClick={onLogout}
            >
              <FaArrowRightFromBracket className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-teal-600" />
              <span className="text-[15px] font-medium leading-4 text-slate-700 group-hover:text-teal-700">
                Logout
              </span>
            </button>
          </div>
        </nav>

        <div className="mt-auto border-t border-slate-200 px-4 py-3 bg-white">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-slate-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-700">
              <FaRegUser className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold text-teal-700">{profile.label}</p>
              <p className="text-[13px] text-slate-400">{profile.description}</p>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
