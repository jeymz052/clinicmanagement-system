"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { usePatients } from "@/src/components/clinic/useClinicData";
import type { UserRole } from "@/src/lib/roles";
import type { AppointmentRecord } from "@/src/lib/appointments";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";

/* ── Role greetings ── */
const ROLE_GREETINGS: Record<UserRole, { greeting: string; subtitle: string }> = {
  SUPER_ADMIN: {
    greeting: "Welcome, Administrator",
    subtitle: "Here\u2019s your clinic overview for today.",
  },
  SECRETARY: {
    greeting: "Welcome, Staff",
    subtitle: "Manage today\u2019s appointments and patient flow.",
  },
  DOCTOR: {
    greeting: "Welcome, Doctor",
    subtitle: "Here\u2019s your schedule and consultations for today.",
  },
  PATIENT: {
    greeting: "Welcome back",
    subtitle: "View your upcoming appointments and records.",
  },
};

const DONUT_COLORS_APPOINTMENT = ["#14b8a6", "#38bdf8"];
const DONUT_COLORS_PATIENT = ["#10b981", "#94a3b8"];
const DONUT_COLORS_PAYMENT = ["#14b8a6", "#fbbf24", "#f87171"];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function shortDay(isoYmd: string) {
  const d = new Date(`${isoYmd}T00:00:00Z`);
  return DAYS[d.getUTCDay()];
}

function last7Days(): string[] {
  const today = new Date();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(isoDate(d));
  }
  return days;
}

/* ── Derived chart data helpers ── */
function buildWeeklyPatientData(appointments: AppointmentRecord[]) {
  const days = last7Days();
  const byDay = new Map<string, Set<string>>();
  for (const day of days) byDay.set(day, new Set());
  for (const appt of appointments) {
    const bucket = byDay.get(appt.date);
    if (bucket) bucket.add(appt.email || appt.patientName);
  }
  return days.map((day) => ({ day: shortDay(day), patients: byDay.get(day)?.size ?? 0 }));
}

function buildAppointmentTrends(appointments: AppointmentRecord[]) {
  const days = last7Days();
  return days.map((day) => {
    const dayAppts = appointments.filter((a) => a.date === day);
    return {
      day: shortDay(day),
      Clinic: dayAppts.filter((a) => a.type === "Clinic").length,
      Online: dayAppts.filter((a) => a.type === "Online").length,
    };
  });
}

function buildAppointmentTypeData(appointments: AppointmentRecord[]) {
  return [
    { name: "Clinic", value: appointments.filter((a) => a.type === "Clinic").length },
    { name: "Online", value: appointments.filter((a) => a.type === "Online").length },
  ];
}

function buildPaymentStatusData(appointments: AppointmentRecord[]) {
  const paid = appointments.filter((a) => a.status === "Paid" || a.status === "Completed").length;
  const pending = appointments.filter((a) => a.status === "Pending Payment").length;
  const confirmedClinic = appointments.filter((a) => a.status === "Confirmed" && a.type === "Clinic").length;
  return [
    { name: "Paid", value: paid },
    { name: "Pending", value: pending },
    { name: "Unbilled", value: confirmedClinic },
  ];
}

/* ── Calendar (navigation only — no event coloring yet) ── */
function Calendar({ appointments }: { appointments: AppointmentRecord[] }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [daysInMonth, firstDay]);

  const apptCountByDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const appt of appointments) {
      const d = new Date(`${appt.date}T00:00:00Z`);
      if (d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth) {
        const day = d.getUTCDate();
        map.set(day, (map.get(day) ?? 0) + 1);
      }
    }
    return map;
  }, [appointments, currentYear, currentMonth]);

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  }

  const isToday = (day: number) =>
    day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900">{MONTHS[currentMonth]} {currentYear}</h3>
        <div className="flex gap-1">
          <button type="button" onClick={prevMonth} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button type="button" onClick={nextMonth} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
        ))}
        {calendarDays.map((day, i) => {
          const count = day ? apptCountByDay.get(day) ?? 0 : 0;
          const hasAppts = count > 0;
          return (
            <div
              key={i}
              className={`text-center py-1.5 text-sm rounded-lg relative ${
                day === null
                  ? ""
                  : isToday(day)
                    ? "bg-teal-600 text-white font-bold"
                    : hasAppts
                      ? "text-slate-900 font-semibold hover:bg-slate-100 cursor-pointer"
                      : "text-slate-700 hover:bg-slate-100 cursor-pointer"
              }`}
            >
              {day}
              {hasAppts && !isToday(day ?? 0) ? (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-teal-500" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityDetails({ appointments }: { appointments: AppointmentRecord[] }) {
  const today = isoDate(new Date());
  const todayAppts = appointments
    .filter((a) => a.date === today)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div>
      <h3 className="text-base font-bold text-slate-900 mb-4">Today&apos;s Activity</h3>
      {todayAppts.length === 0 ? (
        <p className="text-sm text-slate-400">No appointments scheduled for today.</p>
      ) : (
        <div className="space-y-3">
          {todayAppts.map((appt) => {
            const color =
              appt.type === "Online" ? "bg-sky-500" : appt.status === "Completed" ? "bg-emerald-500" : "bg-teal-500";
            return (
              <div key={appt.id} className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {appt.patientName} — {appt.reason || "Consultation"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {appt.start} · Queue #{appt.queueNumber}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    appt.type === "Online" ? "bg-sky-50 text-sky-600" : "bg-teal-50 text-teal-600"
                  }`}
                >
                  {appt.type}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${color})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>{value} today</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function DonutSection({
  title,
  data,
  colors,
  emptyLabel = "No data yet",
}: {
  title: string;
  data: { name: string; value: number }[];
  colors: string[];
  emptyLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center px-4">
      <p className="text-xs font-semibold text-slate-500 mb-2">{title}</p>
      {total === 0 ? (
        <div className="w-20 h-20 flex items-center justify-center rounded-full border-2 border-dashed border-slate-200 text-[10px] text-slate-400 text-center px-2">
          {emptyLabel}
        </div>
      ) : (
        <div className="w-20 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={22} outerRadius={36} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 space-y-1 w-full">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-slate-600">{d.name}</span>
            </div>
            <span className="font-semibold text-slate-800">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { role, user } = useRole();
  const greeting = ROLE_GREETINGS[role];
  const displayName = user?.user_metadata?.full_name ?? "Staff";
  const greetingTitle =
    role === "SUPER_ADMIN" ? "Welcome, Super Admin" : `Welcome, ${displayName}`;
  const { appointments } = useAppointments();
  const { data: patients } = usePatients();

  const todayIso = isoDate(new Date());

  const todayAppointments = appointments.filter((a) => a.date === todayIso);
  const onlineConsultsToday = todayAppointments.filter((a) => a.type === "Online").length;
  const pendingPayments = appointments.filter((a) => a.status === "Pending Payment").length;
  const totalPatients = patients.length;
  const activePatients = patients.filter((p) => p.status === "Active").length;
  const inactivePatients = totalPatients - activePatients;

  const weeklyPatientData = useMemo(() => buildWeeklyPatientData(appointments), [appointments]);
  const appointmentTrendsData = useMemo(() => buildAppointmentTrends(appointments), [appointments]);
  const appointmentTypeData = useMemo(() => buildAppointmentTypeData(appointments), [appointments]);
  const paymentStatusData = useMemo(() => buildPaymentStatusData(appointments), [appointments]);
  const patientStatusData = useMemo(
    () => [
      { name: "Active", value: activePatients },
      { name: "Inactive", value: inactivePatients },
    ],
    [activePatients, inactivePatients],
  );

  const sparkPatients = weeklyPatientData.map((d) => d.patients);
  const sparkAppts = appointmentTrendsData.map((d) => d.Clinic + d.Online);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-down">
        <h1 className="text-2xl font-bold text-slate-900">{greetingTitle}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{greeting.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 p-5 shadow-md text-white transition-all duration-300 hover:shadow-xl hover:scale-[1.03] animate-fade-in-up stagger-1">
          <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/10 animate-float-slow" />
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Total Patients</p>
            <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">{activePatients} active</span>
          </div>
          <p className="text-3xl font-bold mt-2">{totalPatients}</p>
          <p className="text-xs text-white/60 mt-1">Registered in the system</p>
          <MiniSparkline data={sparkPatients.length ? sparkPatients : [0]} color="#ffffff" />
          <ProgressBar value={activePatients} max={Math.max(1, totalPatients)} color="#ffffff" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.03] hover:border-teal-300 animate-fade-in-up stagger-2">
          <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-teal-500 opacity-10" />
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Appointments</p>
            <span className="text-xs font-semibold text-emerald-600">today</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{todayAppointments.length}</p>
          <p className="text-xs text-slate-400 mt-1">Scheduled for today</p>
          <MiniSparkline data={sparkAppts.length ? sparkAppts : [0]} color="#14b8a6" />
          <ProgressBar value={todayAppointments.length} max={25} color="#14b8a6" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.03] hover:border-sky-300 animate-fade-in-up stagger-3">
          <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-sky-500 opacity-10" />
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Online Consults</p>
            <span className="text-xs font-semibold text-emerald-600">today</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{onlineConsultsToday}</p>
          <p className="text-xs text-slate-400 mt-1">Virtual consultations today</p>
          <MiniSparkline
            data={appointmentTrendsData.map((d) => d.Online)}
            color="#38bdf8"
          />
          <ProgressBar value={onlineConsultsToday} max={15} color="#38bdf8" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.03] hover:border-amber-300 animate-fade-in-up stagger-4">
          <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-amber-500 opacity-10" />
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Payments</p>
            <span className="text-xs font-semibold text-amber-600">all time</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{pendingPayments}</p>
          <p className="text-xs text-slate-400 mt-1">Awaiting payment</p>
          <MiniSparkline data={[pendingPayments]} color="#fbbf24" />
          <ProgressBar value={pendingPayments} max={Math.max(10, appointments.length)} color="#fbbf24" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover-lift animate-fade-in-up stagger-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Patient Trends</h2>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyPatientData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="patientGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }} />
                <Area type="monotone" dataKey="patients" stroke="#14b8a6" strokeWidth={2.5} fill="url(#patientGrad)" dot={{ r: 4, fill: "#14b8a6", strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover-lift animate-fade-in-up stagger-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Appointment Trends</h2>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={appointmentTrendsData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }} />
                <Legend wrapperStyle={{ fontSize: "13px" }} />
                <Bar dataKey="Clinic" fill="#14b8a6" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="Online" fill="#38bdf8" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover-lift animate-fade-in-up stagger-7">
        <h3 className="text-base font-bold text-slate-900 mb-3">Overview</h3>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <DonutSection title="Appointment Types" data={appointmentTypeData} colors={DONUT_COLORS_APPOINTMENT} />
          <DonutSection title="Patient Status" data={patientStatusData} colors={DONUT_COLORS_PATIENT} />
          <DonutSection title="Payment Status" data={paymentStatusData} colors={DONUT_COLORS_PAYMENT} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 hover-lift animate-fade-in-up stagger-8">
          <Calendar appointments={appointments} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover-lift animate-fade-in-up stagger-8">
          <ActivityDetails appointments={appointments} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-in-up stagger-8">
        <h2 className="text-base font-bold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction label="Book Appointment" href="/appointments" color="teal" />
          <QuickAction label="View Patients" href="/patients" color="sky" />
          <QuickAction label="Manage Schedules" href="/schedules" color="emerald" />
          <QuickAction label="Payments" href="/payments" color="amber" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label, href, color }: { label: string; href: string; color: "teal" | "sky" | "emerald" | "amber" }) {
  const colorMap = {
    teal: "border-teal-200 hover:bg-teal-50 hover:border-teal-400 text-teal-700",
    sky: "border-sky-200 hover:bg-sky-50 hover:border-sky-400 text-sky-700",
    emerald: "border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 text-emerald-700",
    amber: "border-amber-200 hover:bg-amber-50 hover:border-amber-400 text-amber-700",
  };
  return (
    <Link
      href={href}
      className={`group flex items-center justify-center gap-1.5 rounded-xl border bg-white px-4 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${colorMap[color]}`}
    >
      <span>{label}</span>
      <span className="opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0">→</span>
    </Link>
  );
}
