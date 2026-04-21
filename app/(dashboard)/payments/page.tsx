"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctorFees } from "@/src/components/clinic/useDoctorFees";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";

type OnlinePaymentMethod = "QR" | "Card" | "BankTransfer";

type OnlinePaymentRecord = {
  id: string;
  appointment_id: string | null;
  amount: number;
  method: OnlinePaymentMethod;
  status: "Pending" | "Paid" | "Failed";
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
  paid_at: string | null;
};

function peso(amount: number) {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OnlinePaymentPage() {
  const { accessToken } = useRole();
  const { appointments, isLoading, error } = useAppointments();
  const { fees } = useDoctorFees();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<OnlinePaymentMethod>("QR");
  const [payments, setPayments] = useState<OnlinePaymentRecord[]>([]);
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
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

  const selectedAppointment =
    pendingAppointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null;
  const selectedPayment = selectedAppointment ? latestPaymentByAppointment.get(selectedAppointment.id) ?? null : null;
  const paidCount = payments.filter((payment) => payment.status === "Paid").length;
  const pendingCount = payments.filter((payment) => payment.status === "Pending").length;
  const failedCount = payments.filter((payment) => payment.status === "Failed").length;

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
      setFeedback({ message: "Select a pending online consultation first.", tone: "error" });
      return;
    }
    if (!accessToken) {
      setFeedback({ message: "Your session expired. Please sign in again.", tone: "error" });
      return;
    }

    startTransition(async () => {
      try {
        if (selectedMethod === "Card") {
          const checkoutRes = await fetch("/api/v2/payments/checkout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ appointment_id: selectedAppointment.id }),
          });

          if (checkoutRes.ok) {
            const payload = (await checkoutRes.json()) as { url?: string };
            if (payload.url) {
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

        const payload = (await intentRes.json().catch(() => ({}))) as { payment?: OnlinePaymentRecord; message?: string };
        if (!intentRes.ok) {
          setFeedback({ message: payload.message ?? "Failed to create payment request.", tone: "error" });
          return;
        }

        await refreshPayments();
        setFeedback({
          message:
            selectedMethod === "Card"
              ? "Card payment request created. Appointment remains unconfirmed until payment is marked paid."
              : selectedMethod === "QR"
                ? "QR payment request created. Appointment remains unconfirmed until payment is marked paid."
                : "Bank transfer request created. Appointment remains unconfirmed until payment is marked paid.",
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
            ? "Payment marked paid. The online consultation is now confirmed."
            : "Payment marked failed. The appointment stays unconfirmed until a paid payment exists.",
        tone: "success",
      });
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.2),transparent_32%),linear-gradient(135deg,#064e3b_0%,#0f766e_46%,#14532d_100%)] p-6 text-white shadow-[0_28px_70px_rgba(16,185,129,0.18)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Payment System</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Online consultation payments only</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/90">
              Payment applies only to online consultations. If not paid, the appointment is not confirmed and the meeting link stays unavailable.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <HeroMetric label="Pending" value={String(pendingCount)} />
            <HeroMetric label="Paid" value={String(paidCount)} />
            <HeroMetric label="Failed" value={String(failedCount)} />
          </div>
        </div>
      </section>

      <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 shadow-sm">
        Rule: if payment is not marked <span className="font-semibold">Paid</span>, the online consultation stays <span className="font-semibold">not confirmed</span>.
      </div>

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Online Payment Flow</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Create and process payment</h2>
          <p className="mt-1 text-sm text-slate-500">
            Supported online options: QR payment, card payment, and optional bank transfer.
          </p>

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700">
              Pending online consultation
              <select
                value={selectedAppointmentId}
                onChange={(event) => setSelectedAppointmentId(event.target.value)}
                className="mt-2 w-full rounded-[1.25rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Select appointment</option>
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

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              {
                value: "QR",
                title: "QR Payment",
                note: "GCash / local equivalent",
              },
              {
                value: "Card",
                title: "Card Payment",
                note: "Stripe / card checkout",
              },
              {
                value: "BankTransfer",
                title: "Bank Transfer",
                note: "Optional / manual",
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedMethod(option.value as OnlinePaymentMethod)}
                className={`rounded-[1.5rem] border px-4 py-4 text-left transition-all duration-300 ${
                  selectedMethod === option.value
                    ? "border-emerald-500 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] shadow-[0_16px_28px_rgba(16,185,129,0.14)]"
                    : "border-emerald-100 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/40"
                }`}
              >
                <p className="text-sm font-bold text-slate-900">{option.title}</p>
                <p className="mt-1 text-xs text-slate-500">{option.note}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
            {selectedAppointment ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Selected Consultation</p>
                <p className="text-lg font-bold text-slate-900">{selectedAppointment.patientName}</p>
                <p className="text-sm text-slate-600">
                  {formatDisplayDate(selectedAppointment.date)} · {formatRange(selectedAppointment.start, selectedAppointment.end)}
                </p>
                <p className="text-sm text-slate-600">
                  Amount due: <span className="font-semibold text-emerald-700">{peso(fees.online)}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a pending online consultation to start the payment flow.</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleStartPayment}
              disabled={isLoading || isSubmitting || !selectedAppointmentId}
              className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Processing..." : selectedMethod === "Card" ? "Start Card Payment" : "Create Payment Request"}
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

        <section className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status Board</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Online payment statuses</h2>
          <p className="mt-1 text-sm text-slate-500">
            Appointment confirmation depends on the latest payment status for the online consultation.
          </p>

          <div className="mt-6 space-y-4">
            {onlineAppointments.length > 0 ? (
              onlineAppointments.map((appointment) => {
                const payment = latestPaymentByAppointment.get(appointment.id) ?? null;
                const doctor = getDoctorById(appointment.doctorId);

                return (
                  <div key={appointment.id} className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm transition hover:bg-emerald-50/30">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{appointment.patientName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {doctor?.name} · {formatDisplayDate(appointment.date)} · {formatRange(appointment.start, appointment.end)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge tone={payment?.status ?? "Pending"} label={`Payment: ${payment?.status ?? "Not Started"}`} />
                        <Badge
                          tone={appointment.status === "Confirmed" || appointment.status === "Paid" ? "Paid" : "Pending"}
                          label={`Appointment: ${appointment.status}`}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <p>Method: <span className="font-medium text-slate-900">{formatMethod(payment?.method)}</span></p>
                      <p>Amount: <span className="font-medium text-slate-900">{peso(payment?.amount ?? fees.online)}</span></p>
                      <p>Meeting Link: <span className="font-medium text-slate-900">{appointment.meetingLink ? "Ready" : "Locked"}</span></p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                No online consultations found yet.
              </div>
            )}
          </div>
        </section>
      </div>
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

function Badge({ tone, label }: { tone: "Pending" | "Paid" | "Failed"; label: string }) {
  const classes =
    tone === "Paid"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "Failed"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function formatMethod(method?: OnlinePaymentMethod) {
  if (method === "QR") return "QR Payment";
  if (method === "BankTransfer") return "Bank Transfer";
  if (method === "Card") return "Card Payment";
  return "No payment yet";
}
