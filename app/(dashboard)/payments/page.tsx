"use client";

import { useState, useTransition } from "react";
import { markAppointmentPaidAction } from "@/app/(dashboard)/appointments/actions";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctorFees } from "@/src/components/clinic/useDoctorFees";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";

function peso(amount: number) {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type PaymentMethod = "Card" | "Bank" | "Wallet";

type PaymentForm = {
  appointmentId: string;
  amount: string;
  method: PaymentMethod;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  fullName: string;
};

const DEFAULT_FORM: PaymentForm = {
  appointmentId: "",
  amount: "",
  method: "Card",
  cardNumber: "",
  expiryDate: "",
  cvv: "",
  fullName: "",
};

export default function OnlinePaymentPage() {
  const { accessToken } = useRole();
  const { appointments, setAppointments, isLoading, error } = useAppointments();
  const { fees } = useDoctorFees();
  const [paymentData, setPaymentData] = useState<PaymentForm>(DEFAULT_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();

  const onlineAppointments = appointments.filter((appointment) => appointment.type === "Online");
  const pendingAppointments = onlineAppointments.filter(
    (appointment) => appointment.status === "Pending Payment",
  );
  const paidTodayAmount =
    onlineAppointments.filter((a) => a.status === "Paid").length * fees.online;
  const pendingAmount = pendingAppointments.length * fees.online;
  const selectedAppointment =
    pendingAppointments.find((appointment) => appointment.id === paymentData.appointmentId) ?? null;

  function updateField<K extends keyof PaymentForm>(field: K, value: PaymentForm[K]) {
    setPaymentData((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function handleAppointmentSelection(appointmentId: string) {
    const appointment =
      pendingAppointments.find((candidate) => candidate.id === appointmentId) ?? null;

    setPaymentData((current) => ({
      ...current,
      appointmentId,
      amount: appointment ? fees.online.toFixed(2) : "",
    }));
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAppointment) {
      setFeedback("Select a pending online consultation first.");
      return;
    }

    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    startSubmitTransition(async () => {
      const result = await markAppointmentPaidAction(accessToken, selectedAppointment.id);
      setAppointments(result.appointments);
      setFeedback(result.message);

      if (result.ok) {
        setPaymentData(DEFAULT_FORM);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-down">
        <h1 className="text-3xl font-bold text-slate-900">Online Payment</h1>
        <p className="mt-1 text-sm text-slate-500">
          Process online consultation payments. Payment confirmation automatically generates the
          meeting link.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="animate-fade-in-up stagger-1">
          <PaymentMetric
            label="Pending Online Payments"
            value={peso(pendingAmount)}
            note={`${pendingAppointments.length} appointment${pendingAppointments.length === 1 ? "" : "s"} awaiting payment`}
            tone="red"
          />
        </div>
        <div className="animate-fade-in-up stagger-2">
          <PaymentMetric
            label="Paid Online Consultations"
            value={peso(paidTodayAmount)}
            note={`${onlineAppointments.filter((a) => a.status === "Paid").length} payment-confirmed consults`}
            tone="emerald"
          />
        </div>
        <div className="animate-fade-in-up stagger-3">
          <PaymentMetric
            label="Meeting Links Ready"
            value={onlineAppointments.filter((appointment) => appointment.meetingLink).length.toString()}
            note="Auto-generated after payment"
            tone="slate"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {feedback}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm hover-lift animate-fade-in-up stagger-4">
          <h2 className="text-lg font-bold text-slate-900">Payment Form</h2>
          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Pending Online Consultation
              <select
                value={paymentData.appointmentId}
                onChange={(event) => handleAppointmentSelection(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-teal-200 focus:ring"
              >
                <option value="">Select appointment</option>
                {pendingAppointments.map((appointment) => {
                  const doctor = getDoctorById(appointment.doctorId);

                  return (
                    <option key={appointment.id} value={appointment.id}>
                      {appointment.patientName} - {doctor?.name} - {formatDisplayDate(
                        appointment.date,
                      )} {formatRange(appointment.start, appointment.end)}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label="Amount (₱)">
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(event) => updateField("amount", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 focus:ring"
                  placeholder={fees.online.toFixed(2)}
                  required
                />
              </Field>
              <Field label="Payment Method">
                <select
                  value={paymentData.method}
                  onChange={(event) => updateField("method", event.target.value as PaymentMethod)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-teal-200 focus:ring"
                >
                  <option value="Card">Credit/Debit Card</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Wallet">Digital Wallet</option>
                </select>
              </Field>
            </div>

            {paymentData.method === "Card" ? (
              <>
                <Field label="Cardholder Full Name">
                  <input
                    type="text"
                    value={paymentData.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 focus:ring"
                    placeholder="John Doe"
                  />
                </Field>

                <Field label="Card Number">
                  <input
                    type="text"
                    value={paymentData.cardNumber}
                    onChange={(event) => updateField("cardNumber", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 focus:ring"
                    placeholder="1234 5678 9012 3456"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-6">
                  <Field label="Expiry Date">
                    <input
                      type="text"
                      value={paymentData.expiryDate}
                      onChange={(event) => updateField("expiryDate", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 focus:ring"
                      placeholder="MM/YY"
                    />
                  </Field>
                  <Field label="CVV">
                    <input
                      type="text"
                      value={paymentData.cvv}
                      onChange={(event) => updateField("cvv", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none ring-teal-200 focus:ring"
                      placeholder="123"
                    />
                  </Field>
                </div>
              </>
            ) : null}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading || isSubmitting || !paymentData.appointmentId}
                className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {isSubmitting ? "Processing Payment..." : "Confirm Payment"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentData(DEFAULT_FORM);
                  setFeedback(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm hover-lift animate-fade-in-up stagger-5">
          <h2 className="text-lg font-bold text-slate-900">Pending Consultations</h2>
          <p className="mt-1 text-sm text-slate-500">
            Online consultations stay blocked from meeting access until payment is confirmed.
          </p>

          <div className="mt-6 space-y-4">
            {pendingAppointments.length ? (
              pendingAppointments.map((appointment, i) => {
                const doctor = getDoctorById(appointment.doctorId);

                return (
                  <div
                    key={appointment.id}
                    className={`rounded-2xl border border-slate-200 p-4 transition-all hover:border-amber-300 hover:bg-amber-50/30 animate-slide-in-left stagger-${Math.min(i + 1, 6)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{appointment.patientName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {doctor?.name} · {formatDisplayDate(appointment.date)} ·{" "}
                          {formatRange(appointment.start, appointment.end)}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 animate-soft-pulse">
                        Pending Payment
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      Charge: <span className="font-semibold">{peso(fees.online)}</span>. Meeting link generated immediately after payment.
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">All online consultations are paid. Nice.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentMetric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "red" | "emerald" | "slate";
}) {
  const colorByTone = {
    red: "text-red-600",
    emerald: "text-emerald-600",
    slate: "text-slate-900",
  };
  const accentByTone = {
    red: "bg-red-500",
    emerald: "bg-emerald-500",
    slate: "bg-slate-400",
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover-lift">
      <div className={`absolute -top-4 -right-4 h-16 w-16 rounded-full opacity-10 ${accentByTone[tone]}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${colorByTone[tone]}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

