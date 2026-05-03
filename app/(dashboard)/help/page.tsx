import Link from "next/link";

export default function HelpPage() {
  const faqs = [
    {
      question: "How do I book an appointment?",
      answer:
        "Navigate to the Appointments section, click 'Book Appointment', fill in the required information, select a doctor and time slot, then confirm the booking.",
    },
    {
      question: "What is the difference between clinic and online consultation?",
      answer:
        "Clinic appointments do not require upfront payment. Online consultations require payment before the session. Clinic visits are in-person, while online consultations are via video call.",
    },
    {
      question: "How many patients can a doctor see per hour?",
      answer: "Maximum 5 patients per hour per doctor to ensure quality care.",
    },
    {
      question: "What payment methods are accepted?",
      answer: "We accept credit/debit cards, bank transfers, and digital wallets.",
    },
    {
      question: "Can I reschedule or cancel an appointment?",
      answer:
        "Yes, you can reschedule or cancel up to 24 hours before the appointment. Contact the clinic or use the appointment management section.",
    },
    {
      question: "How do I access my medical records?",
      answer:
        "Go to Patient Records section to view your medical history, lab results, prescriptions, and consultation notes.",
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),linear-gradient(135deg,#f8fffb_0%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(16,185,129,0.10)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Help & Support</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Find answers faster and move back to work</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Use the common questions below or jump directly to the pages you need.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Shortcut href="/appointments" label="Appointments" />
            <Shortcut href="/patients" label="Patients" />
            <Shortcut href="/payments" label="Payments" />
          </div>
        </div>
      </section>

      <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm">
        <input
          type="text"
          placeholder="Search help topics..."
          className="w-full rounded-[1rem] border border-emerald-100 px-4 py-3 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
        />
      </div>

      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <details key={idx} className="group rounded-[1.5rem] border border-emerald-100 bg-white shadow-sm">
            <summary className="flex cursor-pointer items-center justify-between p-5 font-semibold text-slate-900">
              <span>{faq.question}</span>
              <span className="transition group-open:rotate-180">▼</span>
            </summary>
            <p className="border-t border-slate-200 p-5 text-slate-600">{faq.answer}</p>
          </details>
        ))}
      </div>

      <div className="rounded-[1.75rem] border border-blue-200 bg-blue-50 p-6">
        <p className="font-semibold text-blue-900">Still need help?</p>
        <p className="mt-2 text-sm text-blue-800">
          Contact our support team at support@clinic.com or call +1 (555) 123-4567
        </p>
      </div>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-emerald-100 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
    >
      {label}
    </Link>
  );
}
