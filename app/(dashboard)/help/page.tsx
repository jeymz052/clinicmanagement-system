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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Help & Support Center</h1>
        <p className="mt-1 text-sm text-slate-500">Find answers to common questions and get support</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <input
          type="text"
          placeholder="Search help topics..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <details key={idx} className="group rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between p-5 font-semibold text-slate-900">
              <span>{faq.question}</span>
              <span className="transition group-open:rotate-180">▼</span>
            </summary>
            <p className="border-t border-slate-200 p-5 text-slate-600">{faq.answer}</p>
          </details>
        ))}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <p className="font-semibold text-blue-900">Still need help?</p>
        <p className="mt-2 text-sm text-blue-800">
          Contact our support team at support@clinic.com or call +1 (555) 123-4567
        </p>
      </div>
    </div>
  );
}
