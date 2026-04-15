"use client";

import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctorFees } from "@/src/components/clinic/useDoctorFees";
import { formatDisplayDate, getDoctorById } from "@/src/lib/appointments";

function peso(amount: number) {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoicesPage() {
  const { appointments, isLoading, error } = useAppointments();
  const { fees } = useDoctorFees();

  const paymentInvoices = appointments
    .filter((appointment) => appointment.type === "Online")
    .map((appointment) => ({
      id: `INV-${appointment.date.replaceAll("-", "")}-${appointment.queueNumber}`,
      appointment,
      amount: fees.online,
      status: appointment.status === "Paid" ? "Paid" : "Pending",
    }));

  const paidInvoices = paymentInvoices.filter((invoice) => invoice.status === "Paid");
  const pendingInvoices = paymentInvoices.filter((invoice) => invoice.status === "Pending");
  const paidTotal = paidInvoices.reduce((s, i) => s + i.amount, 0);
  const pendingTotal = pendingInvoices.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-down">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Invoice-style view of online consultation payments and meeting-link readiness.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="animate-fade-in-up stagger-1">
          <SummaryCard label="Total Invoices" value={paymentInvoices.length.toString()} tone="slate" />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <SummaryCard
            label="Paid"
            value={`${paidInvoices.length} · ${peso(paidTotal)}`}
            tone="emerald"
          />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <SummaryCard
            label="Pending"
            value={`${pendingInvoices.length} · ${peso(pendingTotal)}`}
            tone="amber"
          />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <SummaryCard
            label="Meeting Links Ready"
            value={paidInvoices.filter((invoice) => invoice.appointment.meetingLink).length.toString()}
            tone="sky"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover-lift animate-fade-in-up stagger-5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-700">Invoice ID</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Patient</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Doctor</th>
              <th className="px-6 py-3 font-semibold text-slate-700 text-right">Amount</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Date</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Meeting Link</th>
            </tr>
          </thead>
          <tbody>
            {paymentInvoices.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                  No online invoices yet.
                </td>
              </tr>
            ) : null}
            {paymentInvoices.map((invoice) => {
              const doctor = getDoctorById(invoice.appointment.doctorId);

              return (
                <tr key={invoice.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-slate-900">{invoice.id}</td>
                  <td className="px-6 py-3 text-slate-600">{invoice.appointment.patientName}</td>
                  <td className="px-6 py-3 text-slate-600">{doctor?.name}</td>
                  <td className="px-6 py-3 text-right font-medium text-slate-900">{peso(invoice.amount)}</td>
                  <td className="px-6 py-3 text-slate-600">
                    {formatDisplayDate(invoice.appointment.date)}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        invoice.status === "Paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {invoice.appointment.meetingLink ? (
                      <a
                        href={invoice.appointment.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
                      >
                        Open Link →
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Waiting for payment</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {isLoading ? (
          <div className="border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            <div className="shimmer h-4 w-32 rounded" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "amber" | "sky";
}) {
  const styles = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    sky: "text-sky-600",
  };
  const accent = {
    slate: "bg-slate-400",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover-lift">
      <div className={`absolute -top-4 -right-4 h-14 w-14 rounded-full opacity-10 ${accent[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${styles[tone]}`}>{value}</p>
    </div>
  );
}
