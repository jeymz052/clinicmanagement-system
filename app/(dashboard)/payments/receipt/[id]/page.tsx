"use client";

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
  if (!value) return "--/--/---- --:--";
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatMethod(method: string) {
  if (method === "BankTransfer") return "BANK";
  return method.toUpperCase();
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

  const issuedAt = billing.issued_at ?? billing.created_at;
  const paidPayments = billing.payments.filter((payment) => payment.status === "Paid");
  const primaryPayment = paidPayments[0] ?? billing.payments[0] ?? null;
  const balance = Number(billing.total) - paidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const receiptNumber = billing.id.slice(0, 8).toUpperCase();
  const visitNumber = billing.appointment_id?.slice(0, 6).toUpperCase() ?? "WALKIN";
  const barcodeValue = `${visitNumber}${receiptNumber}`;

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Receipt</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Printed Clinic Receipt</h1>
          <p className="text-sm text-slate-500">Thermal-style layout based on your sample reference.</p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto flex justify-center print:block">
        <div className="print-receipt w-full max-w-[23rem] rounded-[1.4rem] border border-slate-200 bg-[#fffefc] px-5 py-6 font-mono text-[13px] leading-tight text-black shadow-[0_24px_60px_rgba(15,23,42,0.08)] print:max-w-[80mm] print:rounded-none print:border-0 print:bg-white print:px-3 print:py-2 print:shadow-none">
          <div className="border-b border-dashed border-slate-300 pb-4">
            <p className="text-[1.65rem] font-black uppercase tracking-tight">CHIARA CLINIC</p>
            <div className="mt-2 space-y-0.5 text-[13px] uppercase">
              <p>410 MEDICAL PLAZA, SUITE 210</p>
              <p>NASHVILLE, TN 37203</p>
              <p>(555) 772-1144</p>
              <p>BILLING@CIYCARE.EXAMPLE</p>
            </div>
          </div>

          <div className="border-b border-dashed border-slate-300 py-4 text-[13px] uppercase">
            <p>{formatReceiptDate(issuedAt)}</p>
          </div>

          <div className="border-b border-dashed border-slate-300 py-4 uppercase">
            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <p>PATIENT:</p>
              <p className="text-right">{billing.patient_id.slice(0, 8).toUpperCase()}</p>
              <p>VISIT #:</p>
              <p className="text-right">{visitNumber}</p>
              <p>PHYSICIAN:</p>
              <p className="text-right">DRA. C. PUNZALAN</p>
              <p>STATUS:</p>
              <p className="text-right">{billing.status.toUpperCase()}</p>
            </div>
          </div>

          <div className="border-b border-dashed border-slate-300 py-4 uppercase">
            <div className="space-y-2">
              {billing.billing_items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3">
                  <div>
                    <p>{item.description}</p>
                    <p className="mt-0.5 text-[11px] text-slate-700">
                      QTY {item.quantity} @ {money(Number(item.unit_price))}
                    </p>
                  </div>
                  <p className="text-right font-bold">{money(Number(item.line_total))}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-dashed border-slate-300 py-4 uppercase">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span>SUBTOTAL:</span>
                <span>{money(Number(billing.subtotal))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>TAX:</span>
                <span>{money(Number(billing.tax))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>INSURANCE APPLIED:</span>
                <span>{money(Number(billing.discount))}</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-[18px] font-black">
                <span>TOTAL:</span>
                <span>{money(Number(billing.total))}</span>
              </div>
            </div>
          </div>

          <div className="border-b border-dashed border-slate-300 py-4 uppercase">
            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <p>{primaryPayment ? `${formatMethod(primaryPayment.method)}:` : "PAYMENT:"}</p>
              <p className="text-right">
                {primaryPayment ? `**** ${primaryPayment.id.slice(-4)}` : "PENDING"}
              </p>
              <p>TYPE:</p>
              <p className="text-right">{primaryPayment ? formatMethod(primaryPayment.method) : "--"}</p>
              <p>ENTRY:</p>
              <p className="text-right">{primaryPayment ? "CHIP" : "--"}</p>
              <p>TIME:</p>
              <p className="text-right">{formatReceiptDate(primaryPayment?.paid_at ?? issuedAt)}</p>
              <p>REF:</p>
              <p className="text-right">{receiptNumber}</p>
              <p>STATUS:</p>
              <p className="text-right">
                {balance <= 0 && primaryPayment ? "APPROVED" : billing.status.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="pt-4 uppercase">
            <p className="max-w-[18rem] text-[12px] leading-snug">
              PLEASE KEEP THIS RECEIPT FOR YOUR MEDICAL AND INSURANCE RECORDS.
            </p>
            <Barcode value={barcodeValue} />
          </div>
        </div>
      </div>
    </div>
  );
}
