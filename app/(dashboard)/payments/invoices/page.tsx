"use client";

const INVOICES = [
  {
    id: "INV-2025-001",
    patient: "John Doe",
    amount: "$150.00",
    date: "Nov 15, 2025",
    status: "Paid",
  },
  {
    id: "INV-2025-002",
    patient: "Jane Smith",
    amount: "$250.00",
    date: "Nov 14, 2025",
    status: "Paid",
  },
  {
    id: "INV-2025-003",
    patient: "Michael Brown",
    amount: "$175.00",
    date: "Nov 13, 2025",
    status: "Pending",
  },
  {
    id: "INV-2025-004",
    patient: "Sarah Wilson",
    amount: "$300.00",
    date: "Nov 12, 2025",
    status: "Pending",
  },
];

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">View and manage all invoices</p>
        </div>
        <button className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800">
          Create Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Invoices</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">42</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Paid</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">28 ($8,450)</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Pending</p>
          <p className="mt-2 text-2xl font-bold text-yellow-600">12 ($4,820)</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Overdue</p>
          <p className="mt-2 text-2xl font-bold text-red-600">2 ($980)</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-700">Invoice ID</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Patient</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Amount</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Date</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((invoice) => (
              <tr key={invoice.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">{invoice.id}</td>
                <td className="px-6 py-3 text-slate-600">{invoice.patient}</td>
                <td className="px-6 py-3 text-slate-600">{invoice.amount}</td>
                <td className="px-6 py-3 text-slate-600">{invoice.date}</td>
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
                <td className="px-6 py-3">
                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
