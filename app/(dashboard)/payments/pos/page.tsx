"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, type AppointmentRecord } from "@/src/lib/appointments";

type PricingItem = {
  id: string;
  code: string;
  name: string;
  category: "Consultation" | "Lab" | "Medicine" | "Procedure" | "Other";
  price: number;
  is_active: boolean;
};

type Line = {
  tempId: string;
  pricing_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

type PaymentMethod = "Cash" | "Card" | "BankTransfer" | "GCash" | "QR";

function peso(amount: number) {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function newLine(partial: Partial<Line> = {}): Line {
  return {
    tempId: crypto.randomUUID(),
    pricing_id: null,
    description: "",
    quantity: 1,
    unit_price: 0,
    ...partial,
  };
}

export default function POSBillingPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const { appointments } = useAppointments();
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [selectedApptId, setSelectedApptId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [issuedBillingId, setIssuedBillingId] = useState<string | null>(null);
  const [isWorking, startTransition] = useTransition();

  const canUse = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";

  useEffect(() => {
    if (authLoading || !accessToken) return;
    (async () => {
      const res = await fetch("/api/v2/pricing", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (res.ok) {
        const payload = (await res.json()) as { pricing: PricingItem[] };
        setPricing(payload.pricing);
      }
    })();
  }, [accessToken, authLoading]);

  const billableAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.type === "Clinic" && a.status === "Completed")
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    [appointments],
  );

  const selectedAppt = billableAppointments.find((a) => a.id === selectedApptId) ?? null;

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const total = Math.max(0, subtotal - discount + tax);

  function updateLine(tempId: string, patch: Partial<Line>) {
    setLines((current) => current.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((current) => [...current, newLine()]);
  }

  function removeLine(tempId: string) {
    setLines((current) => (current.length > 1 ? current.filter((l) => l.tempId !== tempId) : current));
  }

  function applyPricing(tempId: string, pricingId: string) {
    const item = pricing.find((p) => p.id === pricingId);
    if (!item) return;
    updateLine(tempId, {
      pricing_id: item.id,
      description: item.name,
      unit_price: Number(item.price),
    });
  }

  function resetForm() {
    setSelectedApptId("");
    setLines([newLine()]);
    setDiscount(0);
    setTax(0);
    setIssuedBillingId(null);
    setFeedback(null);
  }

  function issueBill() {
    if (!accessToken) return;
    if (!selectedAppt) {
      setFeedback({ message: "Pick a completed clinic appointment first.", tone: "error" });
      return;
    }
    const items = lines.filter((l) => l.description.trim() && l.quantity > 0 && l.unit_price > 0);
    if (items.length === 0) {
      setFeedback({ message: "Add at least one valid line item.", tone: "error" });
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/v2/billings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          appointment_id: selectedAppt.id,
          discount,
          tax,
          items: items.map((l) => ({
            pricing_id: l.pricing_id,
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Failed to issue billing", tone: "error" });
        return;
      }
      const payload = (await res.json()) as { billing: { id: string } };
      setIssuedBillingId(payload.billing.id);
      setFeedback({ message: "Billing issued. Record the payment below.", tone: "success" });
    });
  }

  function recordPayment() {
    if (!accessToken || !issuedBillingId) return;
    startTransition(async () => {
      const res = await fetch(`/api/v2/billings/${issuedBillingId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ method: paymentMethod }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Payment failed", tone: "error" });
        return;
      }
      setFeedback({ message: "Payment recorded. Receipt is ready.", tone: "success" });
    });
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-down">
        <h1 className="text-3xl font-bold text-slate-900">POS Billing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Issue a bill for a completed clinic consultation and record payment.
        </p>
      </div>

      {!canUse ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Read-only — only staff can issue bills.
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium animate-fade-in ${
            feedback.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        {/* LEFT — form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover-lift animate-fade-in-up stagger-1">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Create Bill</h2>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Select completed clinic appointment</span>
              <select
                value={selectedApptId}
                onChange={(e) => setSelectedApptId(e.target.value)}
                disabled={!canUse || !!issuedBillingId}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50"
              >
                <option value="">{billableAppointments.length === 0 ? "No completed clinic visits yet" : "Select appointment"}</option>
                {billableAppointments.map((a) => (
                  <AppointmentOption key={a.id} appt={a} />
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Line Items
              </div>
              <div className="divide-y divide-slate-100">
                {lines.map((line, i) => (
                  <div
                    key={line.tempId}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-start animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}
                  >
                    <div className="col-span-12 md:col-span-4">
                      <select
                        value={line.pricing_id ?? ""}
                        onChange={(e) => {
                          if (e.target.value) applyPricing(line.tempId, e.target.value);
                          else updateLine(line.tempId, { pricing_id: null });
                        }}
                        disabled={!canUse || !!issuedBillingId}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Pick from catalog (or type below)</option>
                        {pricing.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.category} · {p.name} · {peso(Number(p.price))}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Or enter description"
                        value={line.description}
                        onChange={(e) => updateLine(line.tempId, { description: e.target.value })}
                        disabled={!canUse || !!issuedBillingId}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <label className="text-[10px] text-slate-500 uppercase">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.tempId, { quantity: Math.max(1, Number(e.target.value)) })}
                        disabled={!canUse || !!issuedBillingId}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <label className="text-[10px] text-slate-500 uppercase">Unit (₱)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => updateLine(line.tempId, { unit_price: Number(e.target.value) })}
                        disabled={!canUse || !!issuedBillingId}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="col-span-3 md:col-span-3 text-right">
                      <label className="text-[10px] text-slate-500 uppercase">Total</label>
                      <p className="font-semibold text-slate-900 text-sm py-1.5">
                        {peso(line.quantity * line.unit_price)}
                      </p>
                    </div>
                    <div className="col-span-1 md:col-span-1 pt-5 text-right">
                      {lines.length > 1 && !issuedBillingId ? (
                        <button
                          type="button"
                          onClick={() => removeLine(line.tempId)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          aria-label="Remove line"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-2">
                <button
                  type="button"
                  onClick={addLine}
                  disabled={!canUse || !!issuedBillingId}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 disabled:text-slate-400"
                >
                  + Add item
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Discount (₱)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  disabled={!canUse || !!issuedBillingId}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Tax (₱)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tax}
                  onChange={(e) => setTax(Math.max(0, Number(e.target.value)))}
                  disabled={!canUse || !!issuedBillingId}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            {!issuedBillingId ? (
              <>
                <button
                  type="button"
                  onClick={issueBill}
                  disabled={!canUse || isWorking || !selectedApptId}
                  className="rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-teal-300 transition-all hover:scale-105 disabled:hover:scale-100"
                >
                  {isWorking ? "Issuing..." : "Issue Bill"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Reset
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Start New Bill
              </button>
            )}
          </div>
        </div>

        {/* RIGHT — summary */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover-lift animate-fade-in-up stagger-2 sticky top-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Summary</h2>

            {selectedAppt ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Patient</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{selectedAppt.patientName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDisplayDate(selectedAppt.date)} · {formatRange(selectedAppt.start, selectedAppt.end)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mb-4 italic">No appointment selected</p>
            )}

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{peso(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-slate-600">
                  <span>Discount</span>
                  <span>−{peso(discount)}</span>
                </div>
              ) : null}
              {tax > 0 ? (
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span>{peso(tax)}</span>
                </div>
              ) : null}
              <div className="flex justify-between pt-2 mt-2 border-t border-slate-200 text-base font-bold text-slate-900">
                <span>Total</span>
                <span>{peso(total)}</span>
              </div>
            </div>

            {issuedBillingId ? (
              <div className="mt-5 border-t border-slate-200 pt-5 animate-fade-in-up">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Record Payment</p>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="GCash">GCash</option>
                  <option value="QR">QR Payment</option>
                  <option value="BankTransfer">Bank Transfer</option>
                </select>
                <div className="flex flex-col gap-2 mt-3">
                  <button
                    type="button"
                    onClick={recordPayment}
                    disabled={isWorking}
                    className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-emerald-300 transition-all hover:scale-[1.02]"
                  >
                    {isWorking ? "Recording..." : `Mark as Paid — ${peso(total)}`}
                  </button>
                  <Link
                    href={`/payments/receipt/${issuedBillingId}`}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-center text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    View / Print Receipt →
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover-lift animate-fade-in-up stagger-3">
            <h3 className="text-sm font-bold text-slate-900 mb-3">POS Rules</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex gap-2">
                <span className="text-teal-500">•</span>
                <span>Applies to clinic visits only. Online consultations are paid up front.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-teal-500">•</span>
                <span>Can only bill appointments with status &quot;Completed&quot;.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-teal-500">•</span>
                <span>Catalog items come from the Pricing page — add services there first.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentOption({ appt }: { appt: AppointmentRecord }) {
  return (
    <option value={appt.id}>
      {appt.patientName} · {formatDisplayDate(appt.date)} · {formatRange(appt.start, appt.end)}
    </option>
  );
}
