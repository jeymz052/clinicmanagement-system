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
  FaStethoscope,
  FaUsers,
} from "react-icons/fa6";

type UserRole = "SUPER_ADMIN" | "ADMIN" | "DOCTOR" | "PATIENT";

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
      label: "Patient",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "All Patients", href: "/patients" },
        { label: "Add Patient", href: "/patients/add" },
        { label: "Patient Records", href: "/patients/records" },
      ],
    },
    {
      label: "Appointment",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments" },
        { label: "Appointment List", href: "/appointments/list" },
        { label: "Calendar View", href: "/appointments/calendar" },
      ],
    },
    {
      label: "Payment",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Online Payment", href: "/payments" },
        { label: "POS Billing", href: "/payments/pos" },
        { label: "Invoices", href: "/payments/invoices" },
      ],
    },
    {
      label: "Consultation",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Online Consultation", href: "/consultations" },
        { label: "Consultation History", href: "/consultations/history" },
      ],
    },
    {
      label: "Schedule",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "Doctor Schedules", href: "/schedules" },
        { label: "Time Slots", href: "/schedules/slots" },
      ],
    },
    { label: "Report", href: "/reports", icon: FaChartLine },
    { label: "Setting", href: "/settings", icon: FaGear },
    { label: "Help & Center", href: "/help", icon: FaCircleQuestion },
  ],
  ADMIN: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    {
      label: "Patient",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "All Patients", href: "/patients" },
        { label: "Add Patient", href: "/patients/add" },
        { label: "Patient Records", href: "/patients/records" },
      ],
    },
    {
      label: "Appointment",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments" },
        { label: "Appointment List", href: "/appointments/list" },
        { label: "Calendar View", href: "/appointments/calendar" },
      ],
    },
    {
      label: "Payment",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Online Payment", href: "/payments" },
        { label: "POS Billing", href: "/payments/pos" },
        { label: "Invoices", href: "/payments/invoices" },
      ],
    },
    {
      label: "Consultation",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Online Consultation", href: "/consultations" },
        { label: "Consultation History", href: "/consultations/history" },
      ],
    },
    {
      label: "Schedule",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "Doctor Schedules", href: "/schedules" },
        { label: "Time Slots", href: "/schedules/slots" },
      ],
    },
    { label: "Report", href: "/reports", icon: FaChartLine },
    { label: "Setting", href: "/settings", icon: FaGear },
    { label: "Help & Center", href: "/help", icon: FaCircleQuestion },
  ],
  DOCTOR: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    {
      label: "Appointment",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "My Appointments", href: "/appointments" },
        { label: "Calendar View", href: "/appointments/calendar" },
      ],
    },
    {
      label: "Patient",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "My Patients", href: "/patients" },
        { label: "Patient Records", href: "/patients/records" },
      ],
    },
    {
      label: "Consultation",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Online Consultation", href: "/consultations" },
        { label: "Consultation History", href: "/consultations/history" },
      ],
    },
    {
      label: "Schedule",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "My Schedule", href: "/schedules" },
        { label: "Time Slots", href: "/schedules/slots" },
      ],
    },
    { label: "Report", href: "/reports", icon: FaChartLine },
    { label: "Setting", href: "/settings", icon: FaGear },
  ],
  PATIENT: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    {
      label: "Appointment",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments" },
        { label: "My Appointments", href: "/appointments/my" },
      ],
    },
    {
      label: "Patient",
      href: "/patients",
      icon: FaUsers,
      subItems: [
        { label: "My Records", href: "/patients/records" },
        { label: "Medical History", href: "/patients/history" },
      ],
    },
    {
      label: "Consultation",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Online Consultation", href: "/consultations" },
        { label: "My Consultation", href: "/consultations/my" },
      ],
    },
    {
      label: "Payment",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Make Payment", href: "/payments" },
        { label: "Payment History", href: "/payments/history" },
      ],
    },
  ],
};

type SidebarProps = {
  role?: UserRole;
  isOpen: boolean;
  onClose: () => void;
};

type ExpandedMenus = {
  [key: string]: boolean;
};

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

export function Sidebar({ role = "ADMIN", isOpen, onClose }: SidebarProps) {
  const navItems = NAV_BY_ROLE[role];
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<ExpandedMenus>({});

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
        className={`fixed left-0 top-0 z-40 flex h-[100svh] max-h-[100svh] w-64 flex-col overflow-hidden border-r border-teal-700 bg-teal-700 shadow-2xl transition-transform duration-300 lg:h-screen lg:max-h-screen lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="shrink-0 border-b border-teal-600 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChiaraLogo />
              <div>
                <h1 className="text-[1.65rem] font-extrabold leading-5 text-white">Chiara</h1>
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-teal-100">
                  Clinic Management
                </p>
              </div>
            </div>

            <button
              className="rounded-md p-2 text-white hover:bg-teal-600 lg:hidden"
              onClick={onClose}
              type="button"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>
        </div>

        <nav className="px-3 py-3">
          <div className="flex flex-col gap-2.5">
            {navItems.map((item) => {
              const itemActive = isActive(item.href);

              return (
                <div key={item.label} className="min-h-0">
                  <div
                    className={`group flex items-center rounded-xl px-2 py-2 ${
                      itemActive ? "bg-white/12" : "hover:bg-white/5"
                    }`}
                  >
                    <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-2">
                      <item.icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          itemActive ? "text-white" : "text-white opacity-70 group-hover:opacity-100"
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`truncate text-sm leading-4 ${
                          itemActive
                            ? "font-semibold text-white"
                            : "font-medium text-white opacity-75 group-hover:opacity-100"
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>

                    {item.subItems ? (
                      <button
                        type="button"
                        className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white opacity-70 transition hover:bg-white/10 hover:opacity-100"
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

                  {item.subItems && expanded[item.label] && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-white/15 pl-2">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.label}
                          href={subItem.href}
                          className={`block rounded-md px-2 py-1 text-[12px] font-medium leading-4 transition ${
                            isActive(subItem.href)
                              ? "bg-white/10 text-white"
                              : "text-white opacity-70 hover:bg-white/5 hover:opacity-100"
                          }`}
                        >
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              className="group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-white/5"
            >
              <FaArrowRightFromBracket className="h-3.5 w-3.5 shrink-0 text-white opacity-70 group-hover:opacity-100" />
              <span className="text-sm font-medium leading-4 text-white opacity-75 group-hover:opacity-100">
                Logout
              </span>
            </button>
          </div>
        </nav>

        <div className="mt-auto border-t border-teal-600 px-4 py-3">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-teal-600"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-200 bg-teal-600 text-white">
              <FaRegUser className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold text-white">Admin User</p>
              <p className="text-[13px] text-teal-100">Clinic Account</p>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
