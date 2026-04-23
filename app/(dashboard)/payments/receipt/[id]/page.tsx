"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type EditableBillingItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

type BillingDraft = {
  discount: number;
  tax: number;
  status: string;
  items: EditableBillingItem[];
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

function buildDraft(billing: Billing): BillingDraft {
  return {
    discount: Number(billing.discount),
    tax: Number(billing.tax),
    status: billing.status,
    items: billing.billing_items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    })),
  };
}

function materializeBilling(billing: Billing, draft: BillingDraft): Billing {
  const billingItems = draft.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.quantity * item.unit_price,
  }));
  const subtotal = billingItems.reduce((sum, item) => sum + item.line_total, 0);
  const total = subtotal - draft.discount + draft.tax;

  return {
    ...billing,
    status: draft.status,
    discount: draft.discount,
    tax: draft.tax,
    subtotal,
    total,
    billing_items: billingItems,
  };
}

export default function ReceiptPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { accessToken, isLoading: authLoading, role } = useRole();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [draft, setDraft] = useState<BillingDraft | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";

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
          setDraft(buildDraft(payload.billing));
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

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/payments/history");
  }

  function updateDraftItem(itemId: string, patch: Partial<EditableBillingItem>) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      };
    });
  }

  function addDraftItem() {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: [
          ...current.items,
          {
            id: `temp-${crypto.randomUUID()}`,
            description: "",
            quantity: 1,
            unit_price: 0,
          },
        ],
      };
    });
  }

  function removeDraftItem(itemId: string) {
    setDraft((current) => {
      if (!current || current.items.length <= 1) return current;
      return {
        ...current,
        items: current.items.filter((item) => item.id !== itemId),
      };
    });
  }

  async function saveReceiptEdits() {
    if (!accessToken || !billing || !draft) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v2/billings/${billing.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          discount: draft.discount,
          tax: draft.tax,
          status: draft.status,
          items: draft.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as { billing?: Billing; message?: string };
      if (!res.ok || !payload.billing) {
        throw new Error(payload.message ?? "Failed to save receipt changes.");
      }

      setBilling(payload.billing);
      setDraft(buildDraft(payload.billing));
      setIsEditing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save receipt changes.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />;
  }

  if (error && !billing) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }

  if (!billing || !draft) {
    return <div className="text-sm text-slate-500">No billing record found.</div>;
  }

  const displayBilling = isEditing ? materializeBilling(billing, draft) : billing;
  const issuedAt = displayBilling.issued_at ?? displayBilling.created_at;
  const paidPayments = displayBilling.payments.filter((payment) => payment.status === "Paid");
  const primaryPayment = paidPayments[0] ?? displayBilling.payments[0] ?? null;
  const balance = Number(displayBilling.total) - paidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const receiptNumber = displayBilling.id.slice(0, 8).toUpperCase();
  const visitNumber = displayBilling.appointment_id?.slice(0, 6).toUpperCase() ?? "WALKIN";
  const barcodeValue = `${visitNumber}${receiptNumber}`;

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Receipt</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Printed Clinic Receipt</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            Back
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => {
                setDraft(buildDraft(billing));
                setIsEditing((current) => !current);
              }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {isEditing ? "Cancel Edit" : "Edit Receipt"}
            </button>
          ) : null}
          {isEditing ? (
            <button
              type="button"
              onClick={saveReceiptEdits}
              disabled={isSaving}
              className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5"
            >
              Print / Save as PDF
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">{error}</div>
      ) : null}

      {isEditing ? (
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] print:hidden">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => current ? { ...current, status: event.target.value } : current)}
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="Draft">Draft</option>
                <option value="Issued">Issued</option>
                <option value="Paid">Paid</option>
                <option value="Void">Void</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Discount
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.discount}
                onChange={(event) =>
                  setDraft((current) => current ? { ...current, discount: Math.max(0, Number(event.target.value) || 0) } : current)
                }
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Tax
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.tax}
                onChange={(event) =>
                  setDraft((current) => current ? { ...current, tax: Math.max(0, Number(event.target.value) || 0) } : current)
                }
                className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="mt-6 space-y-4">
            {draft.items.map((item, index) => (
              <div key={item.id} className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Item {index + 1}</p>
                  {draft.items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeDraftItem(item.id)}
                      className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_8rem_10rem]">
                  <label className="block text-sm font-medium text-slate-700">
                    Description
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) => updateDraftItem(item.id, { description: event.target.value })}
                      className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => updateDraftItem(item.id, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                      className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Unit Price
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) => updateDraftItem(item.id, { unit_price: Math.max(0, Number(event.target.value) || 0) })}
                      className="mt-2 w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addDraftItem}
            className="mt-4 rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            Add Item
          </button>
        </section>
      ) : null}

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
              <p className="text-right">{displayBilling.patient_id.slice(0, 8).toUpperCase()}</p>
              <p>VISIT #:</p>
              <p className="text-right">{visitNumber}</p>
              <p>PHYSICIAN:</p>
              <p className="text-right">DRA. C. PUNZALAN</p>
              <p>STATUS:</p>
              <p className="text-right">{displayBilling.status.toUpperCase()}</p>
            </div>
          </div>

          <div className="border-b border-dashed border-slate-300 py-4 uppercase">
            <div className="space-y-2">
              {displayBilling.billing_items.map((item) => (
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
                <span>{money(Number(displayBilling.subtotal))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>TAX:</span>
                <span>{money(Number(displayBilling.tax))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>INSURANCE APPLIED:</span>
                <span>{money(Number(displayBilling.discount))}</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-[18px] font-black">
                <span>TOTAL:</span>
                <span>{money(Number(displayBilling.total))}</span>
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
                {balance <= 0 && primaryPayment ? "APPROVED" : displayBilling.status.toUpperCase()}
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
