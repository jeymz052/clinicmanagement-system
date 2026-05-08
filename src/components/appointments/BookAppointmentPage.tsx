"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo, useState, useEffect, useTransition } from "react";
import {
  FaCcVisa,
  FaCcMastercard,
  FaCcJcb,
  FaBuildingColumns,
  FaQrcode,
  FaCircleXmark,
  FaBolt,
  FaClipboardList,
  FaHospital,
  FaVideo,
  FaCreditCard,
  FaLock,
  FaUser,
  FaCircleCheck,
  FaCheck,
  FaArrowRotateLeft,
  FaArrowLeft,
  FaArrowRight,
} from "react-icons/fa6";
import { createAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { SharedSlotPicker } from "@/src/components/appointments/SharedSlotPicker";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useAppointmentAvailability } from "@/src/components/appointments/useAppointmentAvailability";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { useDoctorFees } from "@/src/components/clinic/useDoctorFees";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  addDays,
  formatDisplayDate,
  formatRange,
  getAppointmentSummary,
  getDoctorById,
  getWeekDates,
  type AppointmentType,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";
import {
  ONLINE_CONSULTATION_HOURLY_RATE,
  calculateConsultationCharge,
  calculateOnlineConsultationCharge,
  formatDurationLabel,
} from "@/src/lib/consultation-pricing";

type BookingForm = {
  patientName: string;
  email: string;
  phone: string;
  doctorId: string;
  date: string;
  start: string;
  type: AppointmentType;
  reason: string;
  durationMinutes: "60";
  paymentOption: OnlinePaymentOption;
};

// Online consultation now routes every payment option through PayMongo:
//   QR/GCash → PayMongo gcash + qrph
//   Card     → PayMongo card
//   Bank     → PayMongo Direct Online Banking (BPI, UnionBank, RCBC, Chinabank, etc.)
type OnlinePaymentOption =
  | "paymongo_gcash"
  | "paymongo_card"
  | "paymongo_bank";

const today = getClinicToday();
const DEFAULT_DOCTOR_ID = "chiara-punzalan";

const INITIAL_FORM: BookingForm = {
  patientName: "",
  email: "",
  phone: "",
  doctorId: DEFAULT_DOCTOR_ID,
  date: today,
  start: "",
  type: "Clinic",
  reason: "",
  durationMinutes: "60",
  paymentOption: "paymongo_gcash",
};

type OnlinePaymentOptionConfig = {
  value: OnlinePaymentOption;
  label: string;
  detail: string;
  // Tailwind utility classes for the logo tile background + ring colour shown
  // in the selected state, so each option keeps its own brand accent.
  accent: {
    tileBg: string;
    ring: string;
    selectedBorder: string;
    selectedBg: string;
  };
  brands: Array<{ key: string; node: React.ReactNode }>;
  logo: React.ReactNode;
  // `available: false` keeps the option visible but disabled, with a "Not yet
  // available" badge. Flip to true once PayMongo activates the underlying
  // method on the merchant account (see comments in
  // src/lib/services/paymongo.ts for the full activation flip-list).
  available: boolean;
  // Optional explanation shown in the disabled state — kept short so the
  // button doesn't grow taller when toggled off.
  unavailableNote?: string;
};

// NOTE: only `paymongo_gcash` is activated today — it routes to PayMongo's
// QR Ph rail, which is universally scannable by GCash, Maya, and any
// InstaPay / Pesonet-enabled wallet or bank app. Card and Online Bank
// Transfer stay visible (with brand chips) but disabled, so patients can
// see what's coming and staff have a clear "flip to true" once PayMongo
// activates those methods on the merchant account. See the activation
// flip-list in src/lib/services/paymongo.ts.
const ONLINE_PAYMENT_OPTIONS: OnlinePaymentOptionConfig[] = [
  {
    value: "paymongo_gcash",
    label: "QR Ph (GCash, Maya, Banks)",
    detail: "Scan the QR with GCash, Maya, or any InstaPay/Pesonet-enabled wallet or bank app.",
    accent: {
      tileBg: "bg-linear-to-br from-sky-500 to-blue-600",
      ring: "ring-sky-300",
      selectedBorder: "border-sky-500",
      selectedBg: "bg-sky-50/60",
    },
    logo: <GCashLogo />,
    brands: [
      {
        key: "qrph",
        node: (
          <BrandChip className="bg-blue-100 text-blue-800">
            <FaQrcode className="h-3 w-3" /> QR Ph
          </BrandChip>
        ),
      },
      { key: "gcash", node: <BrandChip className="bg-sky-100 text-sky-800">GCash</BrandChip> },
      { key: "maya", node: <BrandChip className="bg-emerald-100 text-emerald-800">Maya</BrandChip> },
      { key: "banks", node: <BrandChip className="bg-slate-100 text-slate-700">+ Banks</BrandChip> },
    ],
    available: true,
  },
  {
    value: "paymongo_card",
    label: "Credit / Debit Card",
    detail: "Pay with Visa, Mastercard, or JCB through PayMongo's secure checkout.",
    accent: {
      tileBg: "bg-linear-to-br from-slate-800 to-slate-950",
      ring: "ring-slate-300",
      selectedBorder: "border-slate-800",
      selectedBg: "bg-slate-50",
    },
    logo: <CardLogo />,
    brands: [
      {
        key: "visa",
        node: (
          <span className="inline-flex items-center justify-center h-7 w-11 rounded-md bg-white border border-slate-200 shadow-xs">
            <FaCcVisa className="h-5 w-auto text-[#1A1F71]" />
          </span>
        ),
      },
      {
        key: "mc",
        node: (
          <span className="inline-flex items-center justify-center h-7 w-11 rounded-md bg-white border border-slate-200 shadow-xs">
            <FaCcMastercard className="h-5 w-auto text-[#EB001B]" />
          </span>
        ),
      },
      {
        key: "jcb",
        node: (
          <span className="inline-flex items-center justify-center h-7 w-11 rounded-md bg-white border border-slate-200 shadow-xs">
            <FaCcJcb className="h-5 w-auto text-[#0E4C96]" />
          </span>
        ),
      },
    ],
    available: false,
    unavailableNote: "Card payments are pending PayMongo activation — please use QR Ph for now.",
  },
  {
    value: "paymongo_bank",
    label: "Online Bank Transfer",
    detail: "Pay directly from your online banking — BPI, UnionBank, RCBC, Chinabank and more.",
    accent: {
      tileBg: "bg-linear-to-br from-emerald-500 to-teal-600",
      ring: "ring-emerald-300",
      selectedBorder: "border-emerald-500",
      selectedBg: "bg-emerald-50/60",
    },
    logo: <BankLogo />,
    brands: [
      { key: "bpi", node: <BrandChip className="bg-rose-100 text-rose-800">BPI</BrandChip> },
      { key: "ubp", node: <BrandChip className="bg-amber-100 text-amber-800">UnionBank</BrandChip> },
      { key: "rcbc", node: <BrandChip className="bg-blue-100 text-blue-800">RCBC</BrandChip> },
      {
        key: "chinabank",
        node: <BrandChip className="bg-red-100 text-red-800">Chinabank</BrandChip>,
      },
      { key: "more", node: <BrandChip className="bg-slate-100 text-slate-700">+ more</BrandChip> },
    ],
    available: false,
    unavailableNote: "Direct bank transfer is pending PayMongo activation — please use QR Ph (your bank app can scan it).",
  },
];

function BrandChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

function GCashLogo() {
  // Stylised GCash brand mark — blue gradient tile with a stylised "G".
  return (
    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-blue-600 shadow-md">
      <span className="text-lg font-black tracking-tight text-white">G</span>
      <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-sky-200">
        <FaQrcode className="h-3 w-3 text-sky-600" />
      </span>
    </span>
  );
}

function CardLogo() {
  // Generic card-shape logo tile with two stripes evoking a chip card.
  return (
    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-slate-800 to-slate-950 shadow-md">
      <svg
        viewBox="0 0 32 24"
        fill="none"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <rect x="1" y="3" width="30" height="18" rx="3" stroke="white" strokeWidth="1.5" />
        <rect x="1" y="7.5" width="30" height="3" fill="white" />
        <rect x="5" y="14" width="8" height="2" rx="0.5" fill="white" opacity="0.85" />
        <rect x="5" y="17" width="5" height="1.5" rx="0.5" fill="white" opacity="0.6" />
      </svg>
    </span>
  );
}

function BankLogo() {
  // Bank columns icon on emerald gradient.
  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-md">
      <FaBuildingColumns className="h-6 w-6 text-white" />
    </span>
  );
}

// Inline icon + label used inside summary rows to identify the visit type
// without resorting to emojis.
function VisitTypeValue({ type }: { type: AppointmentType }) {
  if (type === "Clinic") {
    return (
      <>
        <FaHospital className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        Clinic Visit
      </>
    );
  }
  return (
    <>
      <FaVideo className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
      Online Consultation
    </>
  );
}

function paymentOptionLabel(option: OnlinePaymentOption) {
  return ONLINE_PAYMENT_OPTIONS.find((item) => item.value === option)?.label ?? "Online payment";
}

export default function BookAppointmentPage() {
  const pathname = usePathname();
  const requiresAuthForReview = pathname === "/";
  const { accessToken, role, user, profile } = useRole();
  const { appointments, setAppointments, isLoading, error } = useAppointments();
  // Per-user totals — only meaningful when signed in. On the landing page the
  // user is anonymous, the appointments array stays empty, and we render
  // marketing chips in the header instead.
  const summary = useMemo(() => getAppointmentSummary(appointments), [appointments]);
  const upcomingCount = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.date >= today
          && (a.status === "Confirmed" || a.status === "Checked In"),
      ).length,
    [appointments],
  );
  const { doctors } = useDoctors();
  const [formData, setFormData] = useState<BookingForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [visibleWeekStart, setVisibleWeekStart] = useState(today);

  const primaryDoctor = doctors[0] ?? null;
  const activeDoctorId = primaryDoctor?.slug ?? DEFAULT_DOCTOR_ID;
  const selectedDoctor = primaryDoctor ?? getDoctorById(activeDoctorId);
  const { fees } = useDoctorFees(activeDoctorId);
  const {
    slotStatuses,
    blockedReason,
    nextAvailableSlot,
    isLoading: availabilityLoading,
    error: availabilityError,
  } = useAppointmentAvailability(activeDoctorId, formData.date, formData.type);
  const selectedSlot = slotStatuses.find((slot) => slot.start === formData.start) ?? null;
  const estimatedFee = selectedSlot
    ? formData.type === "Online"
      ? calculateOnlineConsultationCharge(selectedSlot.start, selectedSlot.end)
      : calculateConsultationCharge(fees.clinic, selectedSlot.start, selectedSlot.end)
    : formData.type === "Online"
      ? ONLINE_CONSULTATION_HOURLY_RATE
      : fees.clinic;
  const selectedSlotDuration = selectedSlot
    ? formatDurationLabel(selectedSlot.start, selectedSlot.end)
    : "1 hr";

  const BOOKING_STEP_LABELS = [
    "Service & Doctor",
    "Patient Information",
    "Date & Time",
    "Review & Payment",
  ] as const;

  const calendarWeekStart = useMemo(() => {
    const datesInView = getWeekDates(visibleWeekStart);
    const lastDateInView = datesInView[datesInView.length - 1];
    if (formData.date < visibleWeekStart || formData.date > lastDateInView) {
      return formData.date;
    }
    return visibleWeekStart;
  }, [formData.date, visibleWeekStart]);
  const weekDates = useMemo(() => getWeekDates(calendarWeekStart), [calendarWeekStart]);
  const [activeStep, setActiveStep] = useState(1);

  // Restore any saved draft / reservation after auth or page reload.
  // We mark the very first restore so the write-side effect below doesn't
  // overwrite the saved draft with `INITIAL_FORM` before we've had a chance
  // to read it.
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bookingDraft");
      if (raw) {
        const parsed = JSON.parse(raw) as { formData?: Partial<BookingForm>; activeStep?: number };
        if (parsed?.formData) {
          setFormData((cur) => ({ ...cur, ...parsed.formData }));
        }
        if (parsed?.activeStep) {
          if (requiresAuthForReview && parsed.activeStep === 4 && !accessToken) {
            setActiveStep(3);
          } else {
            setActiveStep(parsed.activeStep);
          }
        }
      }
      const reservationId = localStorage.getItem("bookingReservation");
      if (reservationId) {
        setFeedback({ message: "We held your selected slot — please sign in to complete booking.", type: "success" });
      }
    } catch {
      // ignore
    } finally {
      setHasRestoredDraft(true);
    }
  }, [accessToken, requiresAuthForReview]);

  // Persist the draft as the user types so it survives tab switches, hard
  // refreshes, redirects to /login, and the PayMongo round-trip back to the
  // app. We only start writing AFTER the restore-from-localStorage effect
  // has run — otherwise the first render would clobber the saved draft with
  // `INITIAL_FORM`. The success/reset paths in handleSubmit explicitly
  // remove `bookingDraft`, so a finished booking won't pre-fill the next.
  useEffect(() => {
    if (!hasRestoredDraft) return;
    if (typeof window === "undefined") return;
    try {
      // Don't bother persisting an empty form (avoids leaving stale data
      // for a user who only opened the page and walked away).
      const isEmptyDraft =
        !formData.patientName.trim()
        && !formData.email.trim()
        && !formData.phone.trim()
        && !formData.start
        && !formData.reason.trim();
      if (isEmptyDraft && activeStep === 1) {
        localStorage.removeItem("bookingDraft");
        return;
      }
      localStorage.setItem(
        "bookingDraft",
        JSON.stringify({ formData, activeStep }),
      );
    } catch {
      // Quota errors / private mode → ignore, the in-memory state still works.
    }
  }, [formData, activeStep, hasRestoredDraft]);

  const patientDefaults = useMemo(
    () => ({
      patientName:
        profile?.full_name?.trim() ||
        user?.user_metadata?.full_name ||
        "",
      email: profile?.email || user?.email || "",
      phone: profile?.phone || "",
    }),
    [profile, user],
  );
  const effectivePatientName =
    role === "PATIENT" ? formData.patientName || patientDefaults.patientName : formData.patientName;
  const effectivePatientEmail =
    role === "PATIENT" ? formData.email || patientDefaults.email : formData.email;
  const effectivePatientPhone =
    role === "PATIENT" ? formData.phone || patientDefaults.phone : formData.phone;

  const step1Valid = !!formData.type;
  const step2Valid =
    !!effectivePatientName.trim() && !!effectivePatientEmail.trim() && !!effectivePatientPhone.trim();
  const datePicked = !!formData.date && !blockedReason;
  const step3Valid = datePicked && !!formData.start;
  const step4Done = step1Valid && step2Valid && step3Valid;

  function canAccessStep(step: number): boolean {
    if (step === 1) return true;
    if (step === 2) return step1Valid;
    if (step === 3) return step1Valid && step2Valid;
    if (step === 4) return step1Valid && step2Valid && step3Valid;
    return false;
  }

  function goToStep(step: number) {
    if (step < 1 || step > BOOKING_STEP_LABELS.length) return;
    if (!canAccessStep(step)) return;
    setActiveStep(step);
  }

  function goNext() {
    if (activeStep === 1 && step1Valid) goToStep(2);
    else if (activeStep === 2 && step2Valid) goToStep(3);
    else if (activeStep === 3 && step3Valid) {
      goToStep(4);
    }
  }

  function goBack() {
    if (activeStep > 1) setActiveStep((s) => s - 1);
  }

  function updateForm<K extends keyof BookingForm>(field: K, value: BookingForm[K]) {
    setFormData((current) => {
      const nextState = { ...current, [field]: value };
      if (field === "doctorId" || field === "date" || field === "type") {
        nextState.start = "";
      }
      return nextState;
    });
    setFeedback(null);
  }

  async function startOnlinePayment() {
    if (!accessToken) {
      throw new Error("Your session expired. Please sign in again.");
    }

    const reservationId = typeof window !== "undefined" ? localStorage.getItem("bookingReservation") : null;

    const checkoutRes = await fetch("/api/v2/payments/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        patientName: effectivePatientName,
        email: effectivePatientEmail,
        phone: effectivePatientPhone,
        doctorId: activeDoctorId,
        date: formData.date,
        start: formData.start,
        reason: formData.reason,
        type: "Online",
        reservation_id: reservationId ?? undefined,
        payment_option: formData.paymentOption,
      }),
    });

    const payload = (await checkoutRes.json().catch(() => ({}))) as {
      url?: string | null;
      message?: string;
      reservation_id?: string;
      checkout_mode?: "redirect" | "manual";
      instructions?: string;
      payment_reference?: string;
    };
    if (!checkoutRes.ok) {
      throw new Error(payload.message ?? "Unable to start online payment.");
    }

    if (payload.reservation_id) {
      try {
        localStorage.setItem("bookingReservation", payload.reservation_id);
      } catch {
        // ignore storage errors
      }
    }

    return payload;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeStep !== 4) return;
    
    // CRITICAL: Block submission without authentication
    if (!accessToken || !user || !profile) {
      console.warn("[BookAppointment] Submission blocked: not authenticated", { accessToken: !!accessToken, user: !!user, profile: !!profile });
      setFeedback({ message: "You must sign in or create an account to complete your booking.", type: "error" });
      return;
    }

    startSubmitTransition(async () => {
      if (formData.type === "Online") {
        try {
          const paymentStart = await startOnlinePayment();
          if (paymentStart.checkout_mode === "manual") {
            try {
              localStorage.removeItem("bookingDraft");
            } catch {
              // ignore storage errors
            }

            setFeedback({
              message: paymentStart.payment_reference
                ? `Bank transfer request created. Reference ${paymentStart.payment_reference}. ${paymentStart.instructions ?? "Wait for clinic staff to verify your payment before the appointment is confirmed."}`
                : paymentStart.instructions ?? "Bank transfer request created. Wait for clinic staff to verify your payment before the appointment is confirmed.",
              type: "success",
            });
            setFormData({ ...INITIAL_FORM, doctorId: activeDoctorId, type: "Online" });
            setVisibleWeekStart(today);
            setActiveStep(1);
            return;
          }

          if (!paymentStart.url) {
            throw new Error("Payment checkout link was not returned.");
          }

          window.location.href = paymentStart.url;
        } catch (paymentError) {
          setFeedback({
            message: paymentError instanceof Error ? paymentError.message : "Unable to start online payment.",
            type: "error",
          });
        }
        return;
      }

      const result = await createAppointmentAction(accessToken, {
        patientName: effectivePatientName,
        email: effectivePatientEmail,
        phone: effectivePatientPhone,
        doctorId: activeDoctorId,
        date: formData.date,
        start: formData.start,
        type: formData.type,
        reason: formData.reason,
      });

      setAppointments(result.appointments);

      if (!result.ok) {
        setFeedback({ message: result.message, type: "error" });
        return;
      }
      setFormData({ ...INITIAL_FORM, type: formData.type, doctorId: activeDoctorId });
      setVisibleWeekStart(today);
      setActiveStep(1);
      try {
        localStorage.removeItem("bookingDraft");
        localStorage.removeItem("bookingReservation");
      } catch {
        // ignore storage errors
      }
      setFeedback({
        message: `Booked! ${result.appointment.patientName} with ${selectedDoctor?.name ?? "doctor"} on ${formatDisplayDate(result.appointment.date)} at ${formatRange(result.appointment.start, result.appointment.end)}. Queue #${result.appointment.queueNumber}.${formData.type === "Clinic" ? " Clinic appointment confirmed." : ""}`,
        type: "success",
      });
    });
  }

  return (
    <div className="space-y-6 overflow-x-hidden pb-8">
      {/*
        Header: auth-aware. Logged-in users see their real per-account totals
        from getAppointmentSummary(); anonymous visitors on the landing page
        see marketing chips instead (stats wouldn't apply pre-signup, and
        showing zeros makes the page look broken).
      */}
      <div className="rounded-3xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-5 shadow-[0_18px_45px_rgba(16,185,129,0.08)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Book Appointment</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
              Schedule a visit with {selectedDoctor?.name?.replace(/^Dra\.\s*/, "Dra. ") ?? "Dra. Chiara C. Punzalan M.D."}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              {accessToken
                ? "Pick a service, choose a slot, and confirm in four quick steps."
                : "Browse services and slots freely — sign in only when you're ready to confirm."}
            </p>
          </div>
          {accessToken ? (
            <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 lg:w-auto">
              <HeaderStat label="Total" value={summary.total} />
              <HeaderStat label="Clinic" value={summary.clinicCount} />
              <HeaderStat label="Online" value={summary.onlineCount} />
              <HeaderStat label="Upcoming" value={upcomingCount} highlight />
            </div>
          ) : (
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto lg:max-w-md">
              <MarketingChip label="Mon-Fri 8am-5pm" />
              <MarketingChip label="From PHP 350/hr" />
              <MarketingChip label="Secure PayMongo" />
            </div>
          )}
        </div>
      </div>

      {feedback ? (
        <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${
          feedback.type === "success"
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border border-red-200 bg-red-50 text-red-800"
        }`}>
          {feedback.type === "success"
            ? <FaCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            : <FaCircleXmark className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />}
          <span>{feedback.message}</span>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {availabilityError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{availabilityError}</div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="rounded-4xl border border-emerald-100 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5">
          <HorizontalBookingStepper
            labels={BOOKING_STEP_LABELS}
            activeStep={activeStep}
            onStepClick={goToStep}
          />
        </div>

        <div className="mt-6 space-y-5">
          {activeStep === 1 ? (
            <>
              <section className="rounded-4xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-[0_20px_45px_rgba(16,185,129,0.08)] sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 1 of 4</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Choose Your Visit Type</h2>
                    <p className="mt-2 text-sm text-slate-600">Select whether you&apos;d like an in-person clinic visit or online consultation</p>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2.5 rounded-full border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#d1fae5)] px-4 py-2.5 text-xs font-semibold text-emerald-800 shadow-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    {selectedDoctor?.name ?? "Dra. Chiara C. Punzalan M.D."}
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(["Clinic", "Online"] as AppointmentType[]).map((type) => {
                    const selected = formData.type === type;
                    const Icon = type === "Clinic" ? FaHospital : FaVideo;
                    const blurb =
                      type === "Clinic"
                        ? "In-person visit at the clinic. Pay at the front desk."
                        : "Video call from home. Pay online before the call.";
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateForm("type", type)}
                        aria-pressed={selected}
                        className={`group overflow-hidden rounded-2xl border p-5 text-left transition ${
                          selected
                            ? "border-emerald-500 bg-emerald-50 shadow-[0_12px_28px_rgba(16,185,129,0.16)] ring-2 ring-emerald-200 ring-offset-1"
                            : "border-emerald-100 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_12px_24px_rgba(16,185,129,0.10)]"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <span
                            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${
                              selected ? "bg-white text-emerald-700 shadow-sm" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"
                            }`}
                            aria-hidden="true"
                          >
                            <Icon className="h-6 w-6" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`text-lg font-bold ${selected ? "text-slate-900" : "text-slate-800"}`}>
                                {type === "Clinic" ? "Clinic Visit" : "Online Consultation"}
                              </p>
                              {selected ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                                  <FaCheck className="h-2.5 w-2.5" aria-hidden="true" /> Selected
                                </span>
                              ) : (
                                <span className="inline-flex shrink-0 rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                                  Choose
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-slate-600 leading-snug">{blurb}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/*
                  Single consolidated doctor card — used to be two side-by-side
                  cards that repeated the doctor's name and specialty. Now we
                  show the avatar/initials, name, and specialty once, with the
                  two rates as inline tiles and the optional Online duration
                  picker below.
                */}
                <div className="mt-8 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <span
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base font-black text-emerald-700"
                      aria-hidden="true"
                    >
                      {(selectedDoctor?.name ?? "C P")
                        .replace(/^Dra?\.\s*/, "")
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Your Doctor</p>
                      <p className="mt-1 text-base font-bold text-slate-900">
                        {selectedDoctor?.name ?? "Dra. Chiara C. Punzalan M.D."}
                      </p>
                      {selectedDoctor?.specialty ? (
                        <p className="text-sm text-slate-600">{selectedDoctor.specialty}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div
                      className={`rounded-xl border px-3.5 py-3 transition ${
                        formData.type === "Clinic" ? "border-emerald-300 bg-emerald-50" : "border-emerald-100 bg-white"
                      }`}
                    >
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        <FaHospital className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                        Clinic / hr
                      </p>
                      <p className="mt-1.5 text-lg font-bold text-slate-900">PHP {fees.clinic.toLocaleString()}</p>
                    </div>
                    <div
                      className={`rounded-xl border px-3.5 py-3 transition ${
                        formData.type === "Online" ? "border-emerald-300 bg-emerald-50" : "border-emerald-100 bg-white"
                      }`}
                    >
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        <FaVideo className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                        Online / hr
                      </p>
                      <p className="mt-1.5 text-lg font-bold text-slate-900">
                        PHP {ONLINE_CONSULTATION_HOURLY_RATE.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {formData.type === "Online" ? (
                    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-3">
                      <label htmlFor="duration" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Duration
                      </label>
                      <select
                        id="duration"
                        value={formData.durationMinutes}
                        onChange={(event) => updateForm("durationMinutes", event.target.value as "60")}
                        className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                      >
                        <option value="60">1 hour — PHP 350</option>
                      </select>
                    </div>
                  ) : null}
                </div>
              </section>

              <WizardNav showBack={false} onNext={goNext} nextDisabled={!step1Valid} nextLabel="Next: Patient Info" />
            </>
          ) : null}

          {activeStep === 2 ? (
            <>
              <section className="rounded-4xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-[0_20px_45px_rgba(16,185,129,0.08)] sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 2 of 4</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Patient Information</h2>
                    <p className="mt-1 text-sm text-slate-600">Please provide your contact details for the appointment</p>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    All fields required
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-3 sm:col-span-2">
                    <label htmlFor="fullname" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Full Name *</label>
                    <input 
                      id="fullname"
                      type="text" 
                      value={effectivePatientName} 
                      onChange={(e) => updateForm("patientName", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:bg-emerald-50/30 focus:ring-4 focus:ring-emerald-200" 
                      placeholder="e.g., Juan Dela Cruz" 
                      autoComplete="name" 
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Email *</label>
                    <input 
                      id="email"
                      type="email" 
                      value={effectivePatientEmail} 
                      onChange={(e) => updateForm("email", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:bg-emerald-50/30 focus:ring-4 focus:ring-emerald-200" 
                      placeholder="juan@email.com" 
                      autoComplete="email" 
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Phone *</label>
                    <input 
                      id="phone"
                      type="tel" 
                      value={effectivePatientPhone} 
                      onChange={(e) => updateForm("phone", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:bg-emerald-50/30 focus:ring-4 focus:ring-emerald-200" 
                      placeholder="+63 912 345 6789" 
                      autoComplete="tel" 
                    />
                  </div>
                  <div className="lg:col-span-3 sm:col-span-2">
                    <label htmlFor="reason" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Reason for Visit <span className="font-normal text-slate-500">(Optional)</span></label>
                    <input 
                      id="reason"
                      type="text" 
                      value={formData.reason} 
                      onChange={(e) => updateForm("reason", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-emerald-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:bg-emerald-50/30 focus:ring-4 focus:ring-emerald-200" 
                      placeholder="e.g., Follow-up checkup, Dental cleaning, Consultation" 
                    />
                  </div>
                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step2Valid} nextLabel="Continue to Date & Time" />
            </>
          ) : null}

          {activeStep === 3 ? (
            <>
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_24rem]">
                <div className="space-y-5">
                  <div className="rounded-4xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-[0_20px_45px_rgba(16,185,129,0.08)] sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 3 of 4</p>
                        <h2 className="mt-2 text-xl font-bold text-slate-900">Select Date & Time</h2>
                        <p className="mt-1 text-sm text-slate-600">Choose your preferred appointment date and time slot</p>
                      </div>
                      {nextAvailableSlot ? (
                        <button
                          type="button"
                          onClick={() => {
                            updateForm("date", nextAvailableSlot.date);
                            updateForm("start", nextAvailableSlot.slot.start);
                          }}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 hover:border-emerald-300"
                        >
                          <FaBolt className="h-3 w-3 text-amber-500" aria-hidden="true" />
                          Next: {formatDisplayDate(nextAvailableSlot.date)} {formatRange(nextAvailableSlot.slot.start, nextAvailableSlot.slot.end)}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(180deg,#fafffb_0%,#eefcf2_100%)] p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Calendar Selection</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart((current) => {
                              const candidate = addDays(current, -7);
                              return candidate < today ? today : candidate;
                            })}
                            disabled={calendarWeekStart <= today}
                            className="rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100"
                          >
                            ← Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart(addDays(calendarWeekStart, 7))}
                            className="rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                          >
                            Next →
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                        {weekDates.map((date) => {
                          const localDate = new Date(`${date}T00:00:00`);
                          const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(localDate);
                          const dayNum = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(localDate);
                          const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short" }).format(localDate);
                          const isSelected = formData.date === date;
                          const isToday = date === today;
                          const isPast = date < today;
                          return (
                            <button
                              key={date}
                              type="button"
                              disabled={isPast}
                              onClick={() => updateForm("date", date)}
                              aria-pressed={isSelected}
                              className={`relative rounded-xl border px-2.5 py-2.5 text-center transition ${
                                isSelected
                                  ? "border-emerald-500 bg-emerald-600 text-white shadow-[0_10px_22px_rgba(16,185,129,0.22)]"
                                  : isPast
                                  ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                                  : "border-emerald-100 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/60"
                              }`}
                            >
                              {isToday && !isSelected ? (
                                <span className="absolute right-1.5 top-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                              ) : null}
                              <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${isSelected ? "text-white/90" : "text-slate-500"}`}>
                                {dayLabel}
                              </p>
                              <p className={`mt-1 text-xl font-black leading-none ${isSelected ? "text-white" : isPast ? "text-slate-400" : "text-slate-900"}`}>
                                {dayNum}
                              </p>
                              <p className={`mt-1 text-[10px] font-medium ${isSelected ? "text-white/85" : "text-slate-500"}`}>
                                {isToday ? "Today" : monthLabel}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-emerald-100">
                        <label htmlFor="datepicker" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Or pick a specific date</label>
                        <input 
                          id="datepicker"
                          type="date" 
                          value={formData.date} 
                          min={today} 
                          onChange={(e) => updateForm("date", e.target.value)} 
                          className="w-full sm:w-auto rounded-[1.1rem] border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-200 cursor-pointer" 
                        />
                      </div>
                    </div>

                    {blockedReason ? (
                      <div className="mt-5 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700 shadow-sm font-medium">
                        {blockedReason}
                      </div>
                    ) : null}
                  </div>

                  <SharedSlotPicker
                    slotStatuses={slotStatuses}
                    selectedStart={formData.start}
                    onSelect={(start) => updateForm("start", start)}
                    disabled={isLoading || isSubmitting}
                    loading={availabilityLoading}
                  />
                </div>

                <div className="rounded-4xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-4 shadow-[0_20px_45px_rgba(16,185,129,0.08)] h-fit sm:p-5 lg:sticky lg:top-24">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    <FaClipboardList className="h-3 w-3" aria-hidden="true" />
                    Booking Summary
                  </p>
                  
                  <div className="mt-4 rounded-3xl border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] p-4.5 shadow-sm">
                    <div className="space-y-3">
                      <SummaryRow label="Visit Type" value={<VisitTypeValue type={formData.type} />} done />
                      <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                      <div className="h-px bg-linear-to-r from-emerald-200 to-transparent my-2" />
                      <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={!!formData.date} />
                      <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Choose a slot"} done={!!selectedSlot} />
                      <SummaryRow label="Duration" value={selectedSlot ? selectedSlotDuration : "-"} done={!!selectedSlot} />
                      <div className="h-px bg-linear-to-r from-emerald-200 to-transparent my-2" />
                      <SummaryRow label="Queue #" value={selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "—"} done={!!selectedSlot} />
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border-2 border-emerald-500 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] px-4 py-4 shadow-md">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Estimated Fee</p>
                    <p className="mt-2.5 text-3xl font-black text-emerald-900">
                      PHP {estimatedFee.toLocaleString()}
                    </p>
                    <p className="mt-1.5 text-xs text-emerald-700 font-medium">for {selectedSlotDuration}</p>
                  </div>

                  {formData.type === "Online" ? (
                    <div className="mt-4 rounded-[1.4rem] border border-sky-200 bg-sky-50 px-3.5 py-3.5 text-xs">
                      <p className="inline-flex items-center gap-1.5 font-semibold text-sky-900">
                        <FaCreditCard className="h-3 w-3" aria-hidden="true" />
                        Payment Info
                      </p>
                      <p className="mt-1.5 text-sky-800">Online consultations require payment first. You&apos;ll choose QR, card, or bank transfer on the review step.</p>
                    </div>
                  ) : null}

                  {requiresAuthForReview && !accessToken && (
                    <div className="mt-4 rounded-[1.4rem] border border-emerald-300 bg-emerald-50 px-3.5 py-3.5">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-2">
                        <FaLock className="h-3 w-3" aria-hidden="true" />
                        Sign In Required
                      </p>
                      <p className="text-xs text-emerald-700 mb-3">Please sign in or create an account to proceed to the next step.</p>
                      <div className="flex gap-2 flex-col">
                        <Link href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}#booking`} className="w-full rounded-full bg-emerald-600 text-white px-3 py-2 text-xs font-semibold text-center transition hover:bg-emerald-700">
                          Sign In
                        </Link>
                        <Link href={`/register?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}#booking`} className="w-full rounded-full border border-emerald-300 bg-white text-emerald-700 px-3 py-2 text-xs font-semibold text-center transition hover:bg-emerald-50">
                          Sign Up
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step3Valid} nextLabel="Review & Confirm" />
            </>
          ) : null}

          {activeStep === 4 ? (
            <section className="rounded-4xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f6fef9_100%)] p-4 shadow-[0_22px_48px_rgba(16,185,129,0.08)] sm:p-6">
              {requiresAuthForReview ? (
                <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-emerald-300 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] p-6 shadow-sm sm:p-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Step 4 of 4</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Please sign in to continue</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Sign in or create an account to review and complete your appointment booking.
                  </p>

                  <div className="mt-6 rounded-[1.4rem] border border-emerald-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
                    You can keep your selected service, date, and time. You only need to sign in or sign up before the final confirmation.
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={`/login?next=${encodeURIComponent(`${pathname}#booking`)}`}
                      className="flex-1 rounded-full bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Sign In
                    </Link>
                    <Link
                      href={`/register?next=${encodeURIComponent(`${pathname}#booking`)}`}
                      className="flex-1 rounded-full border border-emerald-300 bg-white px-5 py-3 text-center text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      Sign Up
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">Step 4 of 4</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {formData.type === "Online" ? "Review & Proceed to Payment" : "Review & Confirm"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">Please review your appointment details before confirming</p>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                    <div className="space-y-4 rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(180deg,#ecfdf5_0%,#d1fae5_100%)] p-5.5 shadow-sm">
                      <div>
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-3">
                          <FaClipboardList className="h-3 w-3" aria-hidden="true" />
                          Appointment Details
                        </p>
                        <div className="space-y-3">
                          <SummaryRow label="Visit Type" value={<VisitTypeValue type={formData.type} />} done />
                          <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                          <div className="h-px bg-linear-to-r from-emerald-200 to-transparent" />
                          <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={datePicked} />
                          <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "-"} done={step3Valid} />
                          <SummaryRow label="Duration" value={selectedSlot ? selectedSlotDuration : "-"} done={step3Valid} />
                          {selectedSlot ? <SummaryRow label="Queue #" value={`#${selectedSlot.nextQueueNumber}`} done /> : null}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-200">
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-3">
                          <FaUser className="h-3 w-3" aria-hidden="true" />
                          Patient Information
                        </p>
                        <div className="space-y-3 text-sm">
                          <SummaryRow label="Name" value={effectivePatientName} done={step2Valid} />
                          <SummaryRow label="Email" value={effectivePatientEmail} done={step2Valid} />
                          <SummaryRow label="Phone" value={effectivePatientPhone} done={step2Valid} />
                          {formData.reason ? <SummaryRow label="Reason" value={formData.reason} done /> : null}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-3">Payment Info</p>
                        <SummaryRow
                          label={formData.type === "Online" ? "Amount Due" : "Payable After"}
                          value={`PHP ${estimatedFee.toLocaleString()}`}
                          done
                        />
                        {formData.type === "Online" ? (
                          <SummaryRow
                            label="Payment Method"
                            value={paymentOptionLabel(formData.paymentOption)}
                            done
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border-2 border-emerald-500 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-5.5 shadow-md h-fit lg:sticky lg:top-24">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        {formData.type === "Online" ? (
                          <>
                            <FaCreditCard className="h-3 w-3" aria-hidden="true" />
                            Ready for Payment
                          </>
                        ) : (
                          <>
                            <FaCircleCheck className="h-3 w-3" aria-hidden="true" />
                            Ready to Book
                          </>
                        )}
                      </p>
                      <p className="mt-4 text-3xl font-black text-emerald-900">
                        {formData.type === "Online"
                          ? "Pay Now"
                          : `Queue ${selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "--"}`}
                      </p>
                      <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                        {formData.type === "Online"
                          ? "You will be redirected to PayMongo's secure checkout to complete the payment."
                          : selectedSlot
                            ? `Your appointment is confirmed for ${formatRange(selectedSlot.start, selectedSlot.end)}`
                            : "Select a time slot first"}
                      </p>

                      <div className="mt-5 rounded-[1.4rem] border-2 border-emerald-300 bg-emerald-50 px-4 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          {formData.type === "Online" ? `Amount due (${selectedSlotDuration})` : `Consultation fee (${selectedSlotDuration})`}
                        </p>
                        <p className="mt-2.5 text-3xl font-black text-emerald-900">
                          PHP {estimatedFee.toLocaleString()}
                        </p>
                      </div>

                      {formData.type === "Online" ? (
                        <div className="mt-4 space-y-3 rounded-[1.4rem] border border-sky-200 bg-linear-to-b from-sky-50 to-white px-4 py-4">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-semibold text-sky-900">Choose Payment Method</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700 shadow-sm border border-sky-200">
                              <FaLock className="h-2.5 w-2.5" aria-hidden="true" />
                              Secure · PayMongo
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {ONLINE_PAYMENT_OPTIONS.map((option) => {
                              const isSelected = formData.paymentOption === option.value;
                              const isAvailable = option.available;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  disabled={!isAvailable}
                                  onClick={
                                    isAvailable
                                      ? () => updateForm("paymentOption", option.value)
                                      : undefined
                                  }
                                  aria-pressed={isAvailable ? isSelected : undefined}
                                  aria-disabled={!isAvailable || undefined}
                                  title={!isAvailable ? option.unavailableNote : undefined}
                                  className={`group relative w-full overflow-hidden rounded-2xl border-2 px-3.5 py-3.5 text-left transition-all duration-150 ${
                                    !isAvailable
                                      ? "cursor-not-allowed border-dashed border-slate-200 bg-slate-50/70"
                                      : isSelected
                                      ? `${option.accent.selectedBorder} ${option.accent.selectedBg} shadow-md ring-2 ${option.accent.ring} ring-offset-1`
                                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                                  }`}
                                >
                                  <div className={`flex items-start gap-3.5 ${!isAvailable ? "opacity-60" : ""}`}>
                                    {/* Brand logo tile */}
                                    <div className="shrink-0">{option.logo}</div>

                                    {/* Label + detail + brand chips */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-bold text-slate-900">{option.label}</p>
                                        {!isAvailable ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 border border-amber-200">
                                            Not yet available
                                          </span>
                                        ) : isSelected ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                            <FaCheck className="h-2.5 w-2.5" aria-hidden="true" />
                                            Selected
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-1 text-xs text-slate-600 leading-snug">
                                        {!isAvailable && option.unavailableNote
                                          ? option.unavailableNote
                                          : option.detail}
                                      </p>
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        {option.brands.map((brand) => (
                                          <Fragment key={brand.key}>{brand.node}</Fragment>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Radio indicator (hidden for unavailable methods) */}
                                    {isAvailable ? (
                                      <span
                                        className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                                          isSelected
                                            ? `${option.accent.selectedBorder} bg-white`
                                            : "border-slate-300 bg-white group-hover:border-slate-400"
                                        }`}
                                      >
                                        {isSelected ? (
                                          <span
                                            className={`h-2.5 w-2.5 rounded-full ${option.accent.tileBg}`}
                                            aria-hidden="true"
                                          />
                                        ) : null}
                                      </span>
                                    ) : (
                                      <span
                                        className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white"
                                        aria-hidden="true"
                                      >
                                        <FaLock className="h-2.5 w-2.5 text-slate-400" />
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-slate-500">
                            <span>Powered by</span>
                            <span className="font-bold text-slate-700">PayMongo</span>
                            <span>·</span>
                            <span>SSL encrypted</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!requiresAuthForReview && !accessToken && (
                    <div className="rounded-[1.4rem] border border-emerald-300 bg-emerald-50 px-4 py-4">
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 mb-3">
                        <FaLock className="h-3.5 w-3.5" aria-hidden="true" />
                        Sign In Required
                      </p>
                      <p className="text-sm text-emerald-700 mb-4">You must sign in or create an account to complete your booking.</p>
                      <div className="flex gap-3 flex-col sm:flex-row">
                        <Link href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}#booking`} className="flex-1 rounded-full bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold text-center transition hover:bg-emerald-700">
                          Sign In
                        </Link>
                        <Link href={`/register?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}#booking`} className="flex-1 rounded-full border border-emerald-300 bg-white text-emerald-700 px-4 py-2.5 text-sm font-semibold text-center transition hover:bg-emerald-50">
                          Create Account
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-emerald-100 pt-5 sm:flex-row sm:items-center">
                <button type="button" onClick={goBack} className="order-2 inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 sm:order-1">
                  <FaArrowLeft className="h-3 w-3" aria-hidden="true" />
                  Back
                </button>
                <div className="order-1 flex flex-1 flex-col gap-3 sm:order-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => { setFormData({ ...INITIAL_FORM, doctorId: formData.doctorId, type: formData.type }); setFeedback(null); setActiveStep(1); setVisibleWeekStart(today); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                    <FaArrowRotateLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Start Over
                  </button>
                  <button type="submit" disabled={isLoading || isSubmitting || !step4Done || !accessToken} className="rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmitting ? "Processing..." : formData.type === "Online" ? "Proceed to Payment" : "Confirm Appointment"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function HorizontalBookingStepper({
  labels,
  activeStep,
  onStepClick,
}: {
  labels: readonly string[];
  activeStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <nav aria-label="Booking progress" className="w-full">
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="flex min-w-max items-start px-1">
        {labels.map((label, i) => {
          const step = i + 1;
          const isCurrent = step === activeStep;
          const isComplete = step < activeStep;
          return (
            <Fragment key={label}>
              {i > 0 ? <div className={`mt-5 h-0.5 min-w-1.5 flex-1 ${isComplete ? "bg-emerald-400" : "bg-emerald-100"}`} aria-hidden /> : null}
              <div className="flex w-19 shrink-0 flex-col items-center sm:w-32">
                <button
                  type="button"
                  onClick={() => onStepClick(step)}
                  title={`Step ${step}: ${label}`}
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${
                    isCurrent ? "bg-[linear-gradient(135deg,#059669,#10b981)] text-white shadow-[0_12px_24px_rgba(16,185,129,0.24)]" : isComplete ? "bg-emerald-500 text-white shadow-sm" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {isComplete ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </button>
                <p className={`mt-3 w-full px-1 text-center text-[10px] font-medium leading-tight sm:text-xs ${isCurrent ? "text-slate-900" : "text-slate-600"}`}>
                  {label}
                </p>
              </div>
            </Fragment>
          );
        })}
        </div>
      </div>
    </nav>
  );
}

function WizardNav({
  showBack,
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  showBack?: boolean;
  onBack?: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  nextLabel: string;
}) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${showBack ? "sm:justify-between" : "sm:justify-end"}`}>
      {showBack ? (
        <button type="button" onClick={onBack} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 sm:w-auto">
          <FaArrowLeft className="h-3 w-3" aria-hidden="true" />
          Back
        </button>
      ) : null}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
        {nextLabel}
        <FaArrowRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  done,
}: {
  label: string;
  value: React.ReactNode;
  done: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className={`font-medium ${done ? "text-slate-600" : "text-slate-400"}`}>{label}</span>
      <span
        className={`wrap-break-word font-semibold sm:max-w-[60%] sm:text-right inline-flex items-center justify-end gap-1.5 ${
          done ? "text-slate-900" : "text-slate-500"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// Compact stat tile used by the header when the patient is signed in. Values
// come from getAppointmentSummary() so they always reflect the user's own
// account; the "Upcoming" highlight tile gets a subtle emerald fill so the
// most actionable number reads first.
function HeaderStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`min-w-0 rounded-xl border px-3.5 py-2.5 transition ${
        highlight
          ? "border-emerald-300 bg-emerald-50"
          : "border-emerald-100 bg-white"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black leading-none ${highlight ? "text-emerald-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

// Marketing chip shown only on the public landing page (no auth). Flat,
// no values — just a quick trust cue while the visitor decides whether to
// sign up. The actual booking still gates payment behind sign-in (Step 4).
function MarketingChip({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-white px-3.5 py-2 text-center">
      <p className="text-[11px] font-semibold text-slate-700">{label}</p>
    </div>
  );
}
