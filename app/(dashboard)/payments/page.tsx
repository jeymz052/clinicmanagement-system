"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  FaBuildingColumns,
  FaCcMastercard,
  FaCcVisa,
  FaCircleCheck,
  FaCreditCard,
  FaMoneyCheckDollar,
  FaQrcode,
  FaTriangleExclamation,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctorFees } from "@/src/components/clinic/useDoctorFees";
import { useRole } from "@/src/components/layout/RoleProvider";
import { calculateConsultationCharge, formatDurationLabel } from "@/src/lib/consultation-pricing";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";

type OnlinePaymentMethod = "QR" | "Card" | "BankTransfer";

type OnlinePaymentRecord = {
  id: string;
  appointment_id: string | null;
  amount: number;
  method: "GCash" | "QR" | "Card" | "BankTransfer";
  status: "Pending" | "Paid" | "Failed";
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
  paid_at: string | null;
};

type PaymentOption = {
  value: OnlinePaymentMethod;
  title: string;
  provider: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  logos: Array<{ label: string; tone: string }>;
};

const CARD_PROVIDER_LABEL = process.env.NEXT_PUBLIC_PAYMENT_CARD_PROVIDER_LABEL ?? "PayMongo";
const QR_PROVIDER_LABEL = process.env.NEXT_PUBLIC_PAYMENT_QR_PROVIDER_LABEL ?? "PayMongo";
const ENABLE_QR = process.env.NEXT_PUBLIC_ENABLE_PAYMENT_QR !== "false";
const ENABLE_CARD = process.env.NEXT_PUBLIC_ENABLE_PAYMENT_CARD !== "false";
const ENABLE_BANK_TRANSFER = process.env.NEXT_PUBLIC_ENABLE_PAYMENT_BANK_TRANSFER !== "false";

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    value: "QR",
    title: "GCash / QR Wallet",
    provider: `${QR_PROVIDER_LABEL} hosted checkout`,
    description: "Patient is redirected to PayMongo for GCash wallet payment. The slot stays unconfirmed until payment is marked Paid.",
    icon: FaQrcode,
    accent: "border-emerald-400 bg-[linear-gradient(180deg,#ecfdf5_0%,#dcfce7_100%)]",
    logos: [
      { label: "PayMongo", tone: "bg-emerald-100 text-emerald-700" },
      { label: "GCash", tone: "bg-sky-100 text-sky-700" },
      { label: "QR", tone: "bg-emerald-100 text-emerald-700" },
    ],
  },
  {
    value: "Card",
    title: "Card Checkout",
    provider: `${CARD_PROVIDER_LABEL} hosted checkout`,
    description: "Patient is redirected to PayMongo to enter card details securely. Card number entry happens on the PayMongo page, not inside this app.",
    icon: FaCreditCard,
    accent: "border-sky-400 bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)]",
    logos: [
      { label: "PayMongo", tone: "bg-emerald-100 text-emerald-700" },
      { label: "VISA", tone: "bg-blue-100 text-blue-700" },
      { label: "MC", tone: "bg-orange-100 text-orange-700" },
    ],
  },
  {
    value: "BankTransfer",
    title: "Bank Transfer",
    provider: "Manual / optional",
    description: "Create a pending payment record, then confirm only after transfer proof is verified.",
    icon: FaBuildingColumns,
    accent: "border-amber-400 bg-[linear-gradient(180deg,#fffbeb_0%,#fef3c7_100%)]",
    logos: [
      { label: "BANK", tone: "bg-amber-100 text-amber-700" },
      { label: "MANUAL", tone: "bg-slate-100 text-slate-700" },
    ],
  },
];

const CONFIGURED_PAYMENT_OPTIONS = PAYMENT_OPTIONS.filter((option) => {
  if (option.value === "QR") return ENABLE_QR;
  if (option.value === "Card") return ENABLE_CARD;
  if (option.value === "BankTransfer") return ENABLE_BANK_TRANSFER;
  return true;
});

function peso(amount: number) {
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OnlinePaymentPage() {
  const { accessToken } = useRole();
  const { appointments, isLoading, error } = useAppointments();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<OnlinePaymentMethod>(CONFIGURED_PAYMENT_OPTIONS[0]?.value ?? "QR");
  const [payments, setPayments] = useState<OnlinePaymentRecord[]>([]);
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [redirectingTo, setRedirectingTo] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const onlineAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.type === "Online"),
    [appointments],
  );
  const pendingAppointments = useMemo(
    () => onlineAppointments.filter((appointment) => appointment.status === "Pending Payment"),
    [onlineAppointments],
  );

  const latestPaymentByAppointment = useMemo(() => {
    const map = new Map<string, OnlinePaymentRecord>();
    for (const payment of payments) {
      if (!payment.appointment_id) continue;
      if (!map.has(payment.appointment_id)) {
        map.set(payment.appointment_id, payment);
      }
    }
    return map;
  }, [payments]);

  const selectedAppointment = pendingAppointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null;
  const { fees } = useDoctorFees(selectedAppointment?.doctorId ?? "chiara-punzalan");
  const selectedPayment = selectedAppointment ? latestPaymentByAppointment.get(selectedAppointment.id) ?? null : null;
  const selectedAmountDue = selectedAppointment
    ? calculateConsultationCharge(fees.online, selectedAppointment.start, selectedAppointment.end)
    : fees.online;
  const paidCount = payments.filter((payment) => payment.status === "Paid").length;
  const pendingCount = payments.filter((payment) => payment.status === "Pending").length;
  const failedCount = payments.filter((payment) => payment.status === "Failed").length;
  const selectedOption = CONFIGURED_PAYMENT_OPTIONS.find((option) => option.value === selectedMethod) ?? CONFIGURED_PAYMENT_OPTIONS[0];

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function loadPayments() {
      const url = new URL("/api/v2/payments", window.location.origin);
      onlineAppointments.forEach((appointment) => {
        url.searchParams.append("appointment_id", appointment.id);
      });

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;

      const payload = (await res.json()) as { payments: OnlinePaymentRecord[] };
      if (active) {
        setPayments(payload.payments);
      }
    }

    void loadPayments();
    return () => {
      active = false;
    };
  }, [accessToken, onlineAppointments]);

  async function refreshPayments() {
    if (!accessToken) return;
    const url = new URL("/api/v2/payments", window.location.origin);
    onlineAppointments.forEach((appointment) => {
      url.searchParams.append("appointment_id", appointment.id);
    });
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const payload = (await res.json()) as { payments: OnlinePaymentRecord[] };
    setPayments(payload.payments);
  }

  function handleStartPayment() {
    if (!selectedAppointment) {
      setFeedback({ message: "Select a legacy unpaid online consultation first.", tone: "error" });
      return;
    }
    if (!accessToken) {
      setFeedback({ message: "Your session expired. Please sign in again.", tone: "error" });
      return;
    }

    startTransition(async () => {
      try {
        if (selectedMethod === "Card" || selectedMethod === "QR") {
          const checkoutRes = await fetch("/api/v2/payments/checkout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              appointment_id: selectedAppointment.id,
              method: selectedMethod === "QR" ? "GCash" : "Card",
            }),
          });

          if (checkoutRes.ok) {
            const payload = (await checkoutRes.json()) as { url?: string };
            if (payload.url) {
              setRedirectingTo(selectedMethod === "QR" ? "PayMongo GCash checkout" : "PayMongo card checkout");
              window.location.href = payload.url;
              return;
            }
          }
        }

        const intentRes = await fetch("/api/v2/payments/intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            appointment_id: selectedAppointment.id,
            method: selectedMethod,
          }),
        });

        const payload = (await intentRes.json().catch(() => ({}))) as { message?: string };
        if (!intentRes.ok) {
          setFeedback({ message: payload.message ?? "Failed to create payment request.", tone: "error" });
          return;
        }

        await refreshPayments();
        setFeedback({
          message:
            selectedMethod === "BankTransfer"
              ? "Bank transfer request created. Appointment stays unconfirmed until marked Paid."
              : selectedMethod === "QR"
                ? "Redirecting to PayMongo GCash checkout."
                : "Redirecting to PayMongo card checkout.",
          tone: "success",
        });
      } catch (e) {
        setFeedback({ message: e instanceof Error ? e.message : "Payment request failed.", tone: "error" });
      }
    });
  }

  function updateSelectedPaymentStatus(nextStatus: "Paid" | "Failed") {
    if (!selectedPayment || !accessToken) return;
    startTransition(async () => {
      const res = await fetch("/api/v2/payments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ payment_id: selectedPayment.id, status: nextStatus }),
      });

      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setFeedback({ message: payload.message ?? `Failed to mark payment ${nextStatus.toLowerCase()}.`, tone: "error" });
        return;
      }

      await refreshPayments();
      setFeedback({
        message:
          nextStatus === "Paid"
            ? "Payment marked paid. Online appointment is now confirmed."
            : "Payment marked failed. Appointment remains unconfirmed.",
        tone: "success",
      });
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.2),transparent_32%),linear-gradient(135deg,#064e3b_0%,#0f766e_46%,#14532d_100%)] p-6 text-white shadow-[0_28px_70px_rgba(16,185,129,0.18)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Payment System</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Online Consultation Payments</h1>
            <p className="mt-3 text-sm text-emerald-50/95">
              Online consultation only. Patients pay first, then the appointment is created and confirmed.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <HeroMetric label="Pending" value={String(pendingCount)} />
            <HeroMetric label="Paid" value={String(paidCount)} />
            <HeroMetric label="Failed" value={String(failedCount)} />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-amber-200 bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex items-start gap-3">
          <FaTriangleExclamation className="mt-0.5 text-lg text-amber-600" />
          <div>
            <p className="text-sm font-bold text-slate-900">Confirmation Rule</p>
            <p className="mt-1 text-sm text-slate-600">
              Normal flow: patient selects online consultation, sees the fee, pays through PayMongo, then the appointment is created and confirmed. Any <span className="font-semibold text-amber-700">Pending Payment</span> appointment shown here is a legacy recovery case.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#f0fdf4_0%,#ffffff_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Patient Flow</p>
        <h2 className="mt-2 text-xl font-bold text-slate-900">How online payment works</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <FlowStep number="1" title="Select online consultation" body="Choose online consultation, date, time, and duration during booking." />
          <FlowStep number="2" title="System shows the fee" body="The booking screen calculates the online consultation amount before checkout." />
          <FlowStep number="3" title="Pay through PayMongo" body="GCash or card redirects the patient to PayMongo. Bank transfer stays manual until verified." />
          <FlowStep number="4" title="Appointment is created" body="After payment is marked Paid, the online appointment is created, confirmed, and the meeting link can be issued." />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
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

      {redirectingTo ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">
          Redirecting to {redirectingTo}...
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 1</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Legacy unpaid online appointments</h2>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700">
                Legacy unpaid online consultation
                <select
                  value={selectedAppointmentId}
                  onChange={(event) => setSelectedAppointmentId(event.target.value)}
                  className="mt-2 w-full rounded-[1.25rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="">{pendingAppointments.length > 0 ? "Select legacy appointment" : "No legacy unpaid appointments"}</option>
                  {pendingAppointments.map((appointment) => {
                    const doctor = getDoctorById(appointment.doctorId);
                    return (
                      <option key={appointment.id} value={appointment.id}>
                        {appointment.patientName} - {doctor?.name} - {formatDisplayDate(appointment.date)} {formatRange(appointment.start, appointment.end)}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
              {selectedAppointment ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Selected Consultation</p>
                  <p className="text-lg font-bold text-slate-900">{selectedAppointment.patientName}</p>
                  <p className="text-sm text-slate-600">
                    {getDoctorById(selectedAppointment.doctorId)?.name} | {formatDisplayDate(selectedAppointment.date)} | {formatRange(selectedAppointment.start, selectedAppointment.end)}
                  </p>
                  <p className="text-sm text-slate-600">
                    Amount due: <span className="font-semibold text-emerald-700">{peso(selectedAmountDue)}</span>
                  </p>
                  <p className="text-sm text-slate-500">{formatDurationLabel(selectedAppointment.start, selectedAppointment.end)}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {pendingAppointments.length > 0
                    ? "Select a legacy unpaid online appointment to resume payment."
                    : "No legacy unpaid online appointments. New online bookings start payment during the booking flow."}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 2</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">Choose configured payment method</h2>
              </div>
              <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                Pay-first flow
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {CONFIGURED_PAYMENT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = selectedMethod === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedMethod(option.value)}
                    className={`rounded-[1.6rem] border p-4 text-left transition-all duration-300 ${
                      active
                        ? option.accent + " shadow-[0_16px_28px_rgba(16,185,129,0.14)]"
                        : "border-emerald-100 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                        <Icon className="text-lg text-slate-900" />
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {option.logos.map((logo) => (
                          <span key={`${option.value}-${logo.label}`} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${logo.tone}`}>
                            {logo.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="mt-4 text-sm font-bold text-slate-900">{option.title}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{option.provider}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{option.description}</p>

                    {option.value === "Card" ? (
                      <div className="mt-4 flex items-center gap-2 text-slate-500">
                        <FaCcVisa className="text-xl" />
                        <FaCcMastercard className="text-xl" />
                        <span className="text-xs font-semibold uppercase tracking-[0.16em]">Accepted cards</span>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Selected Method</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{selectedOption.title}</h2>

            <div className="mt-5 rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedOption.provider}</p>
                  <p className="mt-2 text-sm text-slate-600">{selectedOption.description}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {selectedOption.logos.map((logo) => (
                    <span key={`selected-${logo.label}`} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${logo.tone}`}>
                      {logo.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-dashed border-emerald-200 bg-white px-4 py-3 text-sm text-slate-600">
                {selectedMethod === "QR"
                  ? "Redirects to PayMongo where the patient completes GCash payment."
                  : selectedMethod === "Card"
                    ? "Redirects to PayMongo where the patient enters card number, expiry, and other card details securely."
                    : "Creates a pending manual transfer record. The appointment remains unconfirmed until staff marks the payment Paid."}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleStartPayment}
                disabled={isLoading || isSubmitting || !selectedAppointmentId}
                className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? "Processing..."
                  : selectedMethod === "BankTransfer"
                    ? "Create Bank Transfer Request"
                    : selectedMethod === "QR"
                      ? "Pay with GCash via PayMongo"
                      : "Pay with Card via PayMongo"}
              </button>

              {selectedPayment?.status === "Pending" ? (
                <>
                  <button
                    type="button"
                    onClick={() => updateSelectedPaymentStatus("Paid")}
                    disabled={isSubmitting}
                    className="rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    Mark Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedPaymentStatus("Failed")}
                    disabled={isSubmitting}
                    className="rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Mark Failed
                  </button>
                </>
              ) : null}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status Board</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Online payment statuses</h2>

            <div className="mt-6 space-y-4">
              {onlineAppointments.length > 0 ? (
                onlineAppointments.map((appointment) => {
                  const payment = latestPaymentByAppointment.get(appointment.id) ?? null;
                  const doctor = getDoctorById(appointment.doctorId);
                  const confirmed = appointment.status === "Confirmed" || appointment.status === "Paid";

                  return (
                    <div key={appointment.id} className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm transition hover:bg-emerald-50/30">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{appointment.patientName}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {doctor?.name} | {formatDisplayDate(appointment.date)} | {formatRange(appointment.start, appointment.end)}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                            Provider: {formatProvider(payment?.provider, payment?.method)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge tone={payment?.status ?? "Pending"} label={`Payment: ${payment?.status ?? "Not Started"}`} />
                          <Badge tone={confirmed ? "Paid" : "Pending"} label={`Appointment: ${confirmed ? "Confirmed" : "Unconfirmed"}`} />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  No confirmed online consultations found yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payment History</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">Open history module</h2>
              </div>
              <Link
                href="/payments/history"
                className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5"
              >
                View Payment History
              </Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function FlowStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
          {number}
        </div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function Badge({ tone, label }: { tone: "Pending" | "Paid" | "Failed"; label: string }) {
  const classes =
    tone === "Paid"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "Failed"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";

  const Icon = tone === "Paid" ? FaCircleCheck : tone === "Failed" ? FaTriangleExclamation : FaMoneyCheckDollar;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>
      <Icon className="text-[11px]" />
      {label}
    </span>
  );
}

function formatProvider(provider?: string | null, method?: string) {
  if (provider === "paymongo" && method === "Card") return "PayMongo Card Checkout";
  if (provider === "paymongo" && (method === "GCash" || method === "QR")) return "PayMongo GCash Checkout";
  if (provider === "gcash") return "GCash / QR";
  if (provider === "bank_transfer") return "Bank Transfer";
  if (provider === "qr") return "QR Payment";
  if (provider === "stripe") return "Stripe";
  return provider ?? method ?? "Not started";
}
