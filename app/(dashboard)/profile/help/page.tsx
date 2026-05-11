"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FaCircleQuestion, FaCreditCard, FaRegCalendarCheck, FaVideo } from "react-icons/fa6";

const PATIENT_FAQS = [
  {
    question: "How do I book an appointment?",
    answer: "Open Appointments, choose your preferred date and doctor, then confirm the booking details before submitting.",
  },
  {
    question: "Where can I see my upcoming schedule?",
    answer: "Use My Appointments to review your confirmed bookings, schedule changes, and appointment status.",
  },
  {
    question: "How do I join an online consultation?",
    answer: "Go to Consultations near your appointment time. If your session is ready, the meeting link will appear there.",
  },
  {
    question: "Where can I check my payments?",
    answer: "Open Payments to review completed transactions, receipts, and any pending online consultation payments.",
  },
  {
    question: "What if my contact details are wrong?",
    answer: "Please contact the clinic directly so your patient record can be updated correctly and future notifications go to the right account.",
  },
];

export default function PatientHelpPage() {
  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-[2.25rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(220,252,231,0.92),transparent_30%),linear-gradient(135deg,#fbfffc_0%,#eafbf0_55%,#d6f4df_100%)] p-6 shadow-[0_24px_80px_rgba(22,101,52,0.10)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">Patient Help Center</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Simple help for patient tasks</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
          This page focuses on booking, payments, and consultations so patients get the right help without seeing system admin tools.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <HelpShortcut href="/appointments" label="Book Appointment" icon={<FaRegCalendarCheck className="h-4 w-4" />} />
          <HelpShortcut href="/payments" label="Payments" icon={<FaCreditCard className="h-4 w-4" />} />
          <HelpShortcut href="/consultations" label="Consultations" icon={<FaVideo className="h-4 w-4" />} />
        </div>
      </section>

      <div className="space-y-4">
        {PATIENT_FAQS.map((faq) => (
          <details key={faq.question} className="group rounded-[1.75rem] border border-emerald-100 bg-white shadow-sm">
            <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 text-left font-semibold text-slate-900">
              <span>{faq.question}</span>
              <span className="shrink-0 text-emerald-700 transition group-open:rotate-45">+</span>
            </summary>
            <p className="border-t border-slate-100 px-5 py-4 text-sm leading-6 text-slate-600">{faq.answer}</p>
          </details>
        ))}
      </div>

      <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <FaCircleQuestion className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Need more help?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              If something looks wrong with your appointment, payment, or profile details, please contact the clinic directly so staff can assist you.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <HelpLink href="/profile/settings" label="Open My Settings" />
              <HelpLink href="/appointments/my" label="My Appointments" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpShortcut({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50"
    >
      {icon}
      {label}
    </Link>
  );
}

function HelpLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
    >
      {label}
    </Link>
  );
}
