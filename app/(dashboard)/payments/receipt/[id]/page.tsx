"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
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
  provider_ref: string | null;
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

function money(value: number) {
  return `PHP ${Number(value).toFixed(2)}`;
}

function formatReceiptDate(value: string | null) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function buildBarcodePattern(seed: string) {
  return seed
    .replace(/[^A-Za-z0-9]/g, "")
    .padEnd(20, "7")
    .slice(0, 20)
    .split("")
    .map((char, index) => ({
      key: `${char}-${index}`,
      width: (char.charCodeAt(0) % 4) + 1,
    }));
}

function Barcode({ value }: { value: string }) {
  const bars = useMemo(() => buildBarcodePattern(value), [value]);

  return (
    <div className="pt-4">
      <div className="mx-auto flex h-14 w-full items-end justify-center gap-px overflow-hidden rounded-sm bg-white px-1">
        {bars.map((bar, index) => (
          <div
            key={bar.key}
            className={index % 3 === 0 ? "bg-black" : "bg-slate-950"}
            style={{ width: `${bar.width}px`, height: `${32 + (index % 5) * 4}px` }}
          />
        ))}
      </div>
      <p className="mt-1 text-center text-[11px] tracking-[0.18em] text-slate-700">{value}</p>
    </div>
  );
}

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

  if (loading) {
    return <div className="rounded-2xl border border-emerald-100 bg-white p-6 text-sm text-slate-500">Loading receipt...</div>;
  }

  if (error || !billing) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "Receipt not found."}</div>;
  }

  const paidPayment = billing.payments.find((payment) => payment.status === "Paid") ?? null;

  return (
    <div className="space-y-6 pb-8 print:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Receipt</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Clinic POS Receipt</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/payments/history"
            className="rounded-full border border-emerald-100 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            Back to history
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.22)]"
          >
            Print Receipt
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl rounded-[2rem] border border-emerald-100 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)] print:shadow-none">
        <div className="border-b border-dashed border-slate-200 pb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Clinic POS</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Official Receipt</h2>
          <p className="mt-2 text-sm text-slate-500">Receipt #{billing.id.slice(0, 8).toUpperCase()}</p>
          <p className="mt-1 text-sm text-slate-500">Issued {formatReceiptDate(billing.issued_at ?? billing.created_at)}</p>
        </div>

        <div className="grid gap-6 border-b border-dashed border-slate-200 py-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Billing Summary</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="font-semibold">{billing.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Appointment Ref</span>
                <span className="font-semibold">{billing.appointment_id?.slice(0, 8).toUpperCase() ?? "--"}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payment Details</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Method</span>
                <span className="font-semibold">{paidPayment?.method ?? "--"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Paid At</span>
                <span className="font-semibold">{formatReceiptDate(paidPayment?.paid_at ?? null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Reference</span>
                <span className="font-semibold">{paidPayment?.provider_ref ?? "--"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="py-6">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-slate-200 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Total</span>
          </div>

          <div className="divide-y divide-slate-100">
            {billing.billing_items.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 py-4 text-sm text-slate-700">
                <span>{item.description}</span>
                <span className="text-right">{item.quantity}</span>
                <span className="text-right">{money(item.unit_price)}</span>
                <span className="text-right font-semibold">{money(item.line_total)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ml-auto max-w-sm space-y-2 border-t border-dashed border-slate-200 pt-6 text-sm text-slate-700">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{money(billing.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Discount</span>
            <span>{money(billing.discount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tax</span>
            <span>{money(billing.tax)}</span>
          </div>
          <div className="flex items-center justify-between text-lg font-bold text-slate-900">
            <span>Total</span>
            <span>{money(billing.total)}</span>
          </div>
        </div>

        <Barcode value={billing.id.slice(0, 12).toUpperCase()} />
      </div>
    </div>
  );
}
