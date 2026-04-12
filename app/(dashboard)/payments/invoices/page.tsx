"use client";

import { useAppointments } from "@/src/components/appointments/useAppointments";
import { formatDisplayDate, getDoctorById } from "@/src/lib/appointments";

export default function InvoicesPage() {
  const { appointments, isLoading, error } = useAppointments();
  const paymentInvoices = appointments
    .filter((appointment) => appointment.type === "Online")
    .map((appointment) => ({
      id: `INV-${appointment.date.replaceAll("-", "")}-${appointment.queueNumber}`,
      appointment,
      amount: getInvoiceAmount(appointment.queueNumber),
      status: appointment.status === "Paid" ? "Paid" : "Pending",
    }));

  const paidInvoices = paymentInvoices.filter((invoice) => invoice.status === "Paid");
  const pendingInvoices = paymentInvoices.filter((invoice) => invoice.status === "Pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Invoice-style view of online consultation payments and meeting-link readiness.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Total Invoices" value={paymentInvoices.length.toString()} tone="slate" />
        <SummaryCard
          label="Paid"
          value={`${paidInvoices.length} ($${sumInvoices(paidInvoices).toFixed(2)})`}
          tone="emerald"
        />
        <SummaryCard
          label="Pending"
          value={`${pendingInvoices.length} ($${sumInvoices(pendingInvoices).toFixed(2)})`}
          tone="amber"
        />
        <SummaryCard
          label="Meeting Links Ready"
          value={paidInvoices.filter((invoice) => invoice.appointment.meetingLink).length.toString()}
          tone="sky"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-700">Invoice ID</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Patient</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Doctor</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Amount</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Date</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Meeting Link</th>
            </tr>
          </thead>
          <tbody>
            {paymentInvoices.map((invoice) => {
              const doctor = getDoctorById(invoice.appointment.doctorId);

              return (
                <tr key={invoice.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-900">{invoice.id}</td>
                  <td className="px-6 py-3 text-slate-600">{invoice.appointment.patientName}</td>
                  <td className="px-6 py-3 text-slate-600">{doctor?.name}</td>
                  <td className="px-6 py-3 text-slate-600">${invoice.amount.toFixed(2)}</td>
                  <td className="px-6 py-3 text-slate-600">
                    {formatDisplayDate(invoice.appointment.date)}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        invoice.status === "Paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-yellow-100 text-yellow-700"
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
                        className="text-xs font-medium text-sky-700 hover:text-sky-900"
                      >
                        Open Link
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
            Loading invoices...
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

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${styles[tone]}`}>{value}</p>
    </div>
  );
}

function getInvoiceAmount(queueNumber: number) {
  return 120 + queueNumber * 15;
}

function sumInvoices(
  invoices: Array<{
    amount: number;
  }>,
) {
  return invoices.reduce((total, invoice) => total + invoice.amount, 0);
}
