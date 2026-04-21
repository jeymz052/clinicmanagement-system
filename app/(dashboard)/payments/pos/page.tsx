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

type PaymentMethod = "Cash" | "Card" | "BankTransfer";

const POS_CATEGORIES = ["Consultation", "Lab", "Medicine"] as const;
type POSCategory = (typeof POS_CATEGORIES)[number];

function isPOSCategory(category: PricingItem["category"]): category is POSCategory {
  return (POS_CATEGORIES as readonly string[]).includes(category);
}

function peso(amount: number) {
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function buildLineFromPricing(item: PricingItem): Line {
  return newLine({
    pricing_id: item.id,
    description: item.name,
    quantity: 1,
    unit_price: Number(item.price),
  });
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
  const posPricing = useMemo(
    () => pricing.filter((item) => item.is_active && isPOSCategory(item.category)),
    [pricing],
  );

  const catalogByCategory = useMemo(
    () =>
      POS_CATEGORIES.map((category) => ({
        category,
        items: posPricing
          .filter((item) => item.category === category)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    [posPricing],
  );

  const validItems = lines.filter((line) => line.pricing_id && line.quantity > 0 && line.unit_price > 0);
  const subtotal = validItems.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
  const total = Math.max(0, subtotal - discount + tax);

  function updateLine(tempId: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.tempId === tempId ? { ...line, ...patch } : line)));
  }

  function addCatalogItem(item: PricingItem) {
    if (issuedBillingId) return;

    setLines((current) => {
      const matchingLine = current.find(
        (line) =>
          line.pricing_id === item.id &&
          line.description.trim().toLowerCase() === item.name.trim().toLowerCase() &&
          Number(line.unit_price) === Number(item.price),
      );

      if (matchingLine) {
        return current.map((line) =>
          line.tempId === matchingLine.tempId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      if (current.length === 1 && !current[0].description.trim() && current[0].unit_price === 0) {
        return [buildLineFromPricing(item)];
      }

      return [...current, buildLineFromPricing(item)];
    });
  }

  function removeLine(tempId: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.tempId !== tempId) : current));
  }

  function applyPricing(tempId: string, pricingId: string) {
    const item = posPricing.find((entry) => entry.id === pricingId);
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
    setPaymentMethod("Cash");
    setIssuedBillingId(null);
    setFeedback(null);
  }

  function issueBill() {
    if (!accessToken) return;
    if (!selectedAppt) {
      setFeedback({ message: "Pick a completed clinic appointment first.", tone: "error" });
      return;
    }
    if (validItems.length === 0) {
      setFeedback({ message: "Add at least one Consultation, Lab, or Medicine service before generating the bill.", tone: "error" });
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
          items: validItems.map((line) => ({
            pricing_id: line.pricing_id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
          })),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Failed to generate clinic billing.", tone: "error" });
        return;
      }

      const payload = (await res.json()) as { billing: { id: string } };
      setIssuedBillingId(payload.billing.id);
      setFeedback({ message: "Bill generated. You can now accept payment and open the receipt.", tone: "success" });
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
        setFeedback({ message: body.message ?? "Payment failed.", tone: "error" });
        return;
      }

      setFeedback({ message: "Payment accepted. Receipt is ready for printing.", tone: "success" });
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.24),transparent_30%),linear-gradient(135deg,#064e3b_0%,#0f766e_48%,#14532d_100%)] p-6 text-white shadow-[0_28px_70px_rgba(16,185,129,0.18)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Clinic POS / Billing System</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Front-desk billing for clinic appointments only</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/90">
              Generate the bill after consultation, add consultation, lab, and medicine services, accept cash,
              transfer, or card payment, and open the receipt right away.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Applies To" value="Clinic Appointments" />
            <StatTile label="Payment Modes" value="Cash / Transfer / Card" />
            <StatTile label="Output" value="Receipt Ready" />
          </div>
        </div>
      </section>

      {!canUse ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Read-only view. Only clinic staff can generate bills and accept POS payments.
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 1</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">Select completed clinic consultation</h2>
                <p className="mt-1 text-sm text-slate-500">Only completed clinic appointments can be billed in this POS screen.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{billableAppointments.length}</span> billable clinic visit(s)
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Completed clinic appointment</span>
                <select
                  value={selectedApptId}
                  onChange={(event) => setSelectedApptId(event.target.value)}
                  disabled={!canUse || !!issuedBillingId}
                  className="mt-2 w-full rounded-[1.25rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                >
                  <option value="">
                    {billableAppointments.length === 0 ? "No completed clinic visits yet" : "Select appointment"}
                  </option>
                  {billableAppointments.map((appt) => (
                    <AppointmentOption key={appt.id} appt={appt} />
                  ))}
                </select>
              </label>

              <div className="rounded-[1.5rem] border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-4">
                {selectedAppt ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Selected Patient</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">{selectedAppt.patientName}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatDisplayDate(selectedAppt.date)}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatRange(selectedAppt.start, selectedAppt.end)}</p>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">
                    Pick an appointment to load the patient and start building the clinic bill.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 2</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">Add clinic services</h2>
                <p className="mt-1 text-sm text-slate-500">This POS is locked to Consultation, Lab, and Medicine catalog items only.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {catalogByCategory.map((group) => (
                <div key={group.category} className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/30 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">{group.category}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                      {group.items.length} item(s)
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {group.items.length > 0 ? (
                      group.items.slice(0, 6).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addCatalogItem(item)}
                          disabled={!canUse || !!issuedBillingId}
                          className="flex w-full items-center justify-between rounded-[1.2rem] border border-white bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-400"
                        >
                          <span className="min-w-0 pr-3">
                            <span className="block truncate text-sm font-semibold text-slate-900">{item.name}</span>
                            <span className="mt-1 block text-[11px] uppercase tracking-[0.14em] text-slate-400">{item.code}</span>
                          </span>
                          <span className="shrink-0 text-sm font-bold text-teal-700">{peso(Number(item.price))}</span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-400">
                        No {group.category.toLowerCase()} pricing items yet.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-emerald-100 shadow-sm">
              <div className="grid grid-cols-12 gap-3 border-b border-emerald-100 bg-emerald-50/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <div className="col-span-12 md:col-span-4">Service</div>
                <div className="col-span-4 md:col-span-2">Quantity</div>
                <div className="col-span-4 md:col-span-2">Unit Price</div>
                <div className="col-span-3 md:col-span-3">Line Total</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              <div className="divide-y divide-slate-100 bg-white">
                {lines.map((line) => (
                  <div key={line.tempId} className="grid grid-cols-12 gap-3 px-4 py-4">
                    <div className="col-span-12 md:col-span-4">
                      <select
                        value={line.pricing_id ?? ""}
                        onChange={(event) => {
                          if (event.target.value) applyPricing(line.tempId, event.target.value);
                          else updateLine(line.tempId, { pricing_id: null });
                        }}
                        disabled={!canUse || !!issuedBillingId}
                        className="w-full rounded-[1rem] border border-emerald-100 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="">Pick Consultation, Lab, or Medicine</option>
                        {posPricing.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.category} - {item.name} - {peso(Number(item.price))}
                            </option>
                          ))}
                      </select>
                      <div className="mt-2 rounded-[1rem] border border-emerald-100 bg-emerald-50/40 px-3 py-2.5 text-sm text-slate-700">
                        {line.description || "No service selected"}
                      </div>
                    </div>

                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.tempId, { quantity: Math.max(1, Number(event.target.value) || 1) })
                        }
                        disabled={!canUse || !!issuedBillingId}
                        className="w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                      />
                    </div>

                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unit_price}
                        onChange={(event) => updateLine(line.tempId, { unit_price: Number(event.target.value) || 0 })}
                        disabled={!canUse || !!issuedBillingId}
                        className="w-full rounded-[1rem] border border-emerald-100 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                      />
                    </div>

                    <div className="col-span-3 md:col-span-3 flex items-center text-sm font-semibold text-slate-900">
                      {peso(line.quantity * line.unit_price)}
                    </div>

                    <div className="col-span-1 flex items-start justify-end">
                      {lines.length > 1 && !issuedBillingId ? (
                        <button
                          type="button"
                          onClick={() => removeLine(line.tempId)}
                          className="rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove line"
                        >
                          X
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Discount</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))}
                  disabled={!canUse || !!issuedBillingId}
                  className="mt-2 w-full rounded-[1.25rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Tax</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tax}
                  onChange={(event) => setTax(Math.max(0, Number(event.target.value) || 0))}
                  disabled={!canUse || !!issuedBillingId}
                  className="mt-2 w-full rounded-[1.25rem] border border-emerald-100 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="sticky top-24 overflow-hidden rounded-[2rem] border border-emerald-300 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] text-slate-900 shadow-[0_20px_70px_rgba(16,185,129,0.18)]">
            <div className="border-b border-emerald-200 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">POS Terminal</p>
              <h2 className="mt-2 text-2xl font-bold">Clinic Billing</h2>
              <p className="mt-2 text-sm text-slate-600">Review the cart, generate the bill, accept payment, and open the printable receipt.</p>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-[1.5rem] border border-emerald-200 bg-white px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Appointment</p>
                {selectedAppt ? (
                  <>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{selectedAppt.patientName}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatDisplayDate(selectedAppt.date)}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatRange(selectedAppt.start, selectedAppt.end)}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No clinic appointment selected yet.</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Bill Items</p>
                  <p className="text-xs text-slate-500">{validItems.length} valid line(s)</p>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto rounded-[1.5rem] border border-emerald-200 bg-white p-3">
                  {validItems.length > 0 ? (
                    validItems.map((line) => (
                      <div key={line.tempId} className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{line.description}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                              Qty {line.quantity} x {peso(line.unit_price)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-emerald-700">
                            {peso(line.quantity * line.unit_price)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-emerald-200 px-3 py-6 text-center text-sm text-slate-500">
                      Add Consultation, Lab, or Medicine items to build the clinic bill.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-emerald-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>{peso(subtotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>Discount</span>
                  <span>- {peso(discount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>Tax</span>
                  <span>{peso(tax)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-emerald-100 pt-4">
                  <span className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Total Due</span>
                  <span className="text-2xl font-bold text-emerald-700">{peso(total)}</span>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Step 3 - Accept Payment</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { value: "Cash", label: "Cash" },
                    { value: "BankTransfer", label: "Transfer" },
                    { value: "Card", label: "Card" },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      disabled={!issuedBillingId}
                      onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                        paymentMethod === method.value
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-emerald-200 bg-white text-slate-700"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {!issuedBillingId ? (
                  <>
                    <button
                      type="button"
                      onClick={issueBill}
                      disabled={!canUse || isWorking || !selectedApptId}
                      className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-600"
                    >
                      {isWorking ? "Generating Bill..." : "Generate Bill"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="w-full rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50"
                    >
                      Clear POS
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={recordPayment}
                      disabled={isWorking}
                      className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-600"
                    >
                      {isWorking ? "Accepting Payment..." : `Accept ${paymentMethod === "BankTransfer" ? "Transfer" : paymentMethod} Payment`}
                    </button>
                    <Link
                      href={`/payments/receipt/${issuedBillingId}`}
                      className="block w-full rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-emerald-50"
                    >
                      Open Receipt
                    </Link>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="w-full rounded-2xl border border-emerald-200 bg-transparent px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50"
                    >
                      Start New Bill
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">POS / Billing Rules</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <Rule text="Applies only to clinic appointments." />
              <Rule text="Generate the bill after the consultation is completed." />
              <Rule text="Only Consultation, Lab, and Medicine services are allowed in this POS." />
              <Rule text="Accepted payment modes on this screen are cash, transfer, and card." />
              <Rule text="Receipt becomes available after the bill is issued." />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AppointmentOption({ appt }: { appt: AppointmentRecord }) {
  return (
    <option value={appt.id}>
      {appt.patientName} - {formatDisplayDate(appt.date)} - {formatRange(appt.start, appt.end)}
    </option>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/8 px-4 py-4 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-500" />
      <p>{text}</p>
    </div>
  );
}
