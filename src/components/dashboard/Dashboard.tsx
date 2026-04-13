"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { UserRole } from "@/src/lib/roles";
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

/* ── Chart data ── */
const weeklyPatientData = [
  { day: "Mon", patients: 18 },
  { day: "Tue", patients: 24 },
  { day: "Wed", patients: 15 },
  { day: "Thu", patients: 30 },
  { day: "Fri", patients: 22 },
  { day: "Sat", patients: 12 },
  { day: "Sun", patients: 5 },
];

const appointmentTrendsData = [
  { day: "Mon", Clinic: 12, Online: 5 },
  { day: "Tue", Clinic: 10, Online: 7 },
  { day: "Wed", Clinic: 8, Online: 4 },
  { day: "Thu", Clinic: 14, Online: 6 },
  { day: "Fri", Clinic: 11, Online: 8 },
  { day: "Sat", Clinic: 6, Online: 3 },
  { day: "Sun", Clinic: 0, Online: 0 },
];

const appointmentTypeData = [
  { name: "Clinic", value: 65 },
  { name: "Online", value: 35 },
];

const patientStatusData = [
  { name: "Active", value: 78 },
  { name: "Inactive", value: 22 },
];

const paymentStatusData = [
  { name: "Paid", value: 60 },
  { name: "Pending", value: 25 },
  { name: "Overdue", value: 15 },
];

const DONUT_COLORS_APPOINTMENT = ["#14b8a6", "#38bdf8"];
const DONUT_COLORS_PATIENT = ["#10b981", "#94a3b8"];
const DONUT_COLORS_PAYMENT = ["#14b8a6", "#fbbf24", "#f87171"];

/* ── Calendar ── */
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

function Calendar() {
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
        {calendarDays.map((day, i) => (
          <div key={i} className={`text-center py-1.5 text-sm rounded-lg ${
            day === null ? "" : isToday(day) ? "bg-teal-600 text-white font-bold" : "text-slate-700 hover:bg-slate-100 cursor-pointer"
          }`}>{day}</div>
        ))}
      </div>
    </div>
  );
}

function ActivityDetails() {
  const activities = [
    { time: "09:00 AM", label: "Dr. Consultation", type: "Clinic", color: "bg-teal-500" },
    { time: "10:30 AM", label: "Online Checkup", type: "Online", color: "bg-sky-500" },
    { time: "01:00 PM", label: "Walk-in Patient", type: "Clinic", color: "bg-amber-500" },
    { time: "02:30 PM", label: "Follow-up Visit", type: "Online", color: "bg-teal-500" },
    { time: "04:00 PM", label: "Lab Results Review", type: "Clinic", color: "bg-emerald-500" },
  ];
  return (
    <div>
      <h3 className="text-base font-bold text-slate-900 mb-4">Today&apos;s Activity</h3>
      <div className="space-y-3">
        {activities.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${item.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{item.label}</p>
              <p className="text-xs text-slate-400">{item.time}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.type === "Online" ? "bg-sky-50 text-sky-600" : "bg-teal-50 text-teal-600"}`}>{item.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Mini sparkline for stat card ── */
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

/* ── Progress bar for stat card ── */
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
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

/* ── Donut section (fits inside shared container) ── */
function DonutSection({
  title,
  data,
  colors,
}: {
  title: string;
  data: { name: string; value: number }[];
  colors: string[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center px-4">
      <p className="text-xs font-semibold text-slate-500 mb-2">{title}</p>
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

/* ── Main Dashboard ── */
export default function Dashboard() {
  const { role } = useRole();
  const greeting = ROLE_GREETINGS[role];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{greeting.greeting}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{greeting.subtitle}</p>
      </div>

      {/* Stat Cards — first card is green themed */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Patients — green card */}
        <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 p-5 shadow-md text-white transition-all duration-300 hover:shadow-xl hover:scale-[1.03]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Total Patients</p>
            <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">+15.2%</span>
          </div>
          <p className="text-3xl font-bold mt-2">0</p>
          <p className="text-xs text-white/60 mt-1">Registered in the system</p>
          <MiniSparkline data={[3, 5, 4, 8, 6, 9, 7]} color="#ffffff" />
          <ProgressBar value={0} max={100} color="#ffffff" />
        </div>

        {/* Appointments Today */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.03] hover:border-teal-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Appointments</p>
            <span className="text-xs font-semibold text-emerald-600">+10.4%</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">0</p>
          <p className="text-xs text-slate-400 mt-1">Scheduled for today</p>
          <MiniSparkline data={[2, 4, 3, 7, 5, 6, 8]} color="#14b8a6" />
          <ProgressBar value={0} max={25} color="#14b8a6" />
        </div>

        {/* Online Consults */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.03] hover:border-teal-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Online Consults</p>
            <span className="text-xs font-semibold text-emerald-600">+16.5%</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">0</p>
          <p className="text-xs text-slate-400 mt-1">Virtual consultations today</p>
          <MiniSparkline data={[1, 3, 2, 5, 4, 6, 3]} color="#38bdf8" />
          <ProgressBar value={0} max={15} color="#38bdf8" />
        </div>

        {/* Pending Payments */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.03] hover:border-teal-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Payments</p>
            <span className="text-xs font-semibold text-amber-600">+5.3%</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">0</p>
          <p className="text-xs text-slate-400 mt-1">Awaiting payment</p>
          <MiniSparkline data={[4, 3, 5, 2, 6, 4, 3]} color="#fbbf24" />
          <ProgressBar value={0} max={20} color="#fbbf24" />
        </div>
      </div>

      {/* Patient Trends + Appointment Trends */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Patient Trends — area/line chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-teal-200">
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
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }} />
                <Area type="monotone" dataKey="patients" stroke="#14b8a6" strokeWidth={2.5} fill="url(#patientGrad)" dot={{ r: 4, fill: "#14b8a6", strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Appointment Trends — bar chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-teal-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Appointment Trends</h2>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={appointmentTrendsData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }} />
                <Legend wrapperStyle={{ fontSize: "13px" }} />
                <Bar dataKey="Clinic" fill="#14b8a6" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="Online" fill="#38bdf8" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Donut Charts — compact row */}
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-teal-200">
        <h3 className="text-base font-bold text-slate-900 mb-3">Overview</h3>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <DonutSection title="Appointment Types" data={appointmentTypeData} colors={DONUT_COLORS_APPOINTMENT} />
          <DonutSection title="Patient Status" data={patientStatusData} colors={DONUT_COLORS_PATIENT} />
          <DonutSection title="Payment Status" data={paymentStatusData} colors={DONUT_COLORS_PAYMENT} />
        </div>
      </div>

      {/* Calendar + Activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 transition-all duration-300 hover:shadow-lg hover:border-teal-200">
          <Calendar />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-teal-200">
          <ActivityDetails />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
    <Link href={href} className={`flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${colorMap[color]}`}>
      {label}
    </Link>
  );
}
