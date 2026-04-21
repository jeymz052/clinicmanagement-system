"use client";

import { use, useEffect, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";

type BillingItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  paid_at: string | null;
  provider: string | null;
};

type Billing = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  issued_at: string | null;
  created_at: string;
  billing_items: BillingItem[];
  payments: Payment[];
};

type PageProps = { params: Promise<{ id: string }> };

export default function ReceiptPage({ params }: PageProps) {
  const { id } = use(params);
  const { accessToken, isLoading: authLoading } = useRole();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/v2/billings/${id}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? "Receipt not found");
        }
        const payload = (await res.json()) as { billing: Billing };
        if (active) {
          setBilling(payload.billing);
          setError(null);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load receipt");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading, id]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }
  if (!billing) {
    return <div className="text-sm text-slate-500">No billing record found.</div>;
  }

  const paidPayments = billing.payments.filter((p) => p.status === "Paid");
  const paidTotal = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Number(billing.total) - paidTotal;

  return (
    <div className="space-y-6 print:space-y-0">
      {/* Action bar — hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clinic POS Billing Receipt</h1>
          <p className="text-sm text-slate-500">POS Bill #{billing.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Printable card */}
      <div className="print-receipt mx-auto max-w-3xl rounded-[2rem] border border-emerald-200 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="border-b border-emerald-200 pb-5 print:border-slate-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 print:text-slate-700">CHIARA Clinic</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Official Clinic POS Billing Receipt</h2>
              <p className="mt-1 text-xs text-slate-500">Clinic POS / Billing System - Receipt Copy</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right print:border-slate-300 print:bg-transparent">
              <p className="text-xs text-slate-500">POS Bill / Receipt #</p>
              <p className="text-sm font-mono font-semibold text-slate-900">{billing.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-5 text-sm border-b border-slate-200 print:border-slate-300">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Issued</p>
            <p className="text-slate-800 font-medium mt-1">
              {billing.issued_at ? new Date(billing.issued_at).toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
            <p
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                billing.status === "Paid"
                  ? "bg-emerald-50 text-emerald-700"
                  : billing.status === "Issued"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {billing.status}
            </p>
          </div>
        </div>

        {/* Line items */}
        <div className="py-5">
          <p className="mb-3 text-xs text-slate-500 uppercase tracking-wider">Clinic POS Bill Details</p>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 print:border-slate-300">
              <tr>
                <th className="text-left font-semibold py-2">Description</th>
                <th className="text-center font-semibold py-2 w-16">Qty</th>
                <th className="text-right font-semibold py-2 w-24">Unit Price</th>
                <th className="text-right font-semibold py-2 w-28">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {billing.billing_items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 print:border-slate-200">
                  <td className="py-2">{item.description}</td>
                  <td className="text-center py-2">{item.quantity}</td>
                  <td className="text-right py-2">₱{Number(item.unit_price).toLocaleString()}</td>
                  <td className="text-right py-2 font-medium">₱{Number(item.line_total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1.5 border-t border-slate-200 py-5 text-sm print:border-slate-300">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>₱{Number(billing.subtotal).toLocaleString()}</span>
          </div>
          {Number(billing.discount) > 0 ? (
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>−₱{Number(billing.discount).toLocaleString()}</span>
            </div>
          ) : null}
          {Number(billing.tax) > 0 ? (
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>₱{Number(billing.tax).toLocaleString()}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 print:border-slate-300">
            <span>Total</span>
            <span>₱{Number(billing.total).toLocaleString()}</span>
          </div>
        </div>

        {/* Payments */}
        {paidPayments.length > 0 ? (
          <div className="border-t border-slate-200 py-5 print:border-slate-300">
            <p className="mb-2 text-xs text-slate-500 uppercase tracking-wider">POS Payment Record</p>
            {paidPayments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm py-1">
                <span className="text-slate-600">
                  {p.method} · {p.paid_at ? new Date(p.paid_at).toLocaleString() : ""}
                </span>
                <span className="font-medium text-emerald-700">−₱{Number(p.amount).toLocaleString()}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold print:border-slate-300">
              <span>Balance</span>
              <span className={balance <= 0 ? "text-emerald-700" : "text-amber-700"}>
                ₱{balance.toLocaleString()}
              </span>
            </div>
          </div>
        ) : null}

        <div className="border-t border-dashed border-slate-200 pt-5 print:border-slate-300">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Prepared by CHIARA Clinic POS Billing System</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
          <p className="pt-4 text-center text-[10px] text-slate-400 print:block">
            Thank you for choosing CHIARA Clinic. Present this clinic POS billing receipt for verification and records.
          </p>
        </div>
      </div>
    </div>
  );
}
