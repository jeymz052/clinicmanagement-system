import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor, isStaff } from "@/src/lib/http";
import type {
  Billing,
  BillingItem,
  Payment,
  PaymentMethod,
} from "@/src/lib/db/types";
import { getAppointment, getDoctor } from "@/src/lib/services/booking";
import { enqueueNotification } from "@/src/lib/services/notification";
import { calculateConsultationCharge, formatDurationLabel } from "@/src/lib/consultation-pricing";

export type BillingItemInput = {
  pricing_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

const POS_ALLOWED_CATEGORIES = new Set(["Consultation", "Lab", "Medicine"]);
const POS_ALLOWED_METHODS = new Set<PaymentMethod>(["Cash", "Card", "BankTransfer"]);

export async function issueBilling(input: {
  appointment_id: string;
  items: BillingItemInput[];
  discount?: number;
  tax?: number;
}, actor: Actor): Promise<{ billing: Billing; items: BillingItem[] }> {
  if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor")
    throw new HttpError(403, "Forbidden");

  const appt = await getAppointment(input.appointment_id);
  if (appt.appointment_type !== "Clinic")
    throw new HttpError(400, "POS billing is clinic-only");
  if (appt.status !== "Completed")
    throw new HttpError(400, "Cannot bill before consultation is completed");

  const supabase = getSupabaseAdmin();
  const pricingIds = [...new Set(input.items.map((item) => item.pricing_id).filter((value): value is string => !!value))];
  if (pricingIds.length !== input.items.length) {
    throw new HttpError(400, "POS billing requires catalog services only.");
  }

  const { data: pricingRows, error: pricingError } = await supabase
    .from("pricing")
    .select("id, name, category, price, is_active")
    .in("id", pricingIds);
  if (pricingError) throw pricingError;

  const pricingById = new Map(
    (pricingRows ?? []).map((row) => [
      row.id as string,
      row as { id: string; name: string; category: string; price: number; is_active: boolean },
    ]),
  );

  const normalizedItems = input.items.map((item) => {
    if (!item.pricing_id) throw new HttpError(400, "Each POS line must use a clinic pricing item.");
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new HttpError(400, "Quantity must be greater than zero.");
    }

    const pricingItem = pricingById.get(item.pricing_id);
    if (!pricingItem || !pricingItem.is_active) {
      throw new HttpError(400, "One or more POS services are unavailable.");
    }
    if (!POS_ALLOWED_CATEGORIES.has(pricingItem.category)) {
      throw new HttpError(400, "POS only allows Consultation, Lab, and Medicine services.");
    }

    return {
      pricing_id: pricingItem.id,
      description: pricingItem.name,
      quantity: item.quantity,
      unit_price: Number(pricingItem.price),
    };
  });
  const doctor = await getDoctor(appt.doctor_id);
  const consultationLine = {
    pricing_id: null,
    description: `Clinic consultation (${formatDurationLabel(appt.start_time, appt.end_time)} @ PHP ${Number(doctor.consultation_fee_clinic).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hr)`,
    quantity: 1,
    unit_price: calculateConsultationCharge(
      Number(doctor.consultation_fee_clinic),
      appt.start_time,
      appt.end_time,
    ),
  };

  const allItems = [consultationLine, ...normalizedItems];
  const subtotal = allItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const { data: billing, error: billErr } = await supabase
    .from("billings")
    .insert({
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      subtotal,
      discount: input.discount ?? 0,
      tax: input.tax ?? 0,
      status: "Issued",
      issued_at: new Date().toISOString(),
    })
    .select()
    .single<Billing>();
  if (billErr) throw billErr;

  const { data: items, error: itemsErr } = await supabase
    .from("billing_items")
    .insert(
      allItems.map((i) => ({
        billing_id: billing.id,
        pricing_id: i.pricing_id ?? null,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    )
    .select();
  if (itemsErr) throw itemsErr;

  await enqueueNotification({
    user_id: appt.patient_id,
    template: "billing_issued",
    channels: ["email"],
    payload: { billing_id: billing.id, appointment_id: appt.id },
  });

  return { billing, items: items as BillingItem[] };
}

export async function recordBillingPayment(
  billingId: string,
  method: PaymentMethod,
  actor: Actor,
): Promise<{ billing: Billing; payment: Payment }> {
  if (!isStaff(actor.profile.role))
    throw new HttpError(403, "Only staff can record POS payments");
  if (!POS_ALLOWED_METHODS.has(method))
    throw new HttpError(400, "POS only accepts Cash, Transfer, or Card payments");

  const supabase = getSupabaseAdmin();
  const { data: billing, error } = await supabase
    .from("billings")
    .select("*")
    .eq("id", billingId)
    .single<Billing>();
  if (error) throw new HttpError(404, "Billing not found");
  if (billing.status === "Paid") throw new HttpError(400, "Billing already paid");
  if (billing.status === "Void") throw new HttpError(400, "Billing is void");
  if (!billing.appointment_id) throw new HttpError(400, "POS payment requires a clinic appointment billing.");

  const appt = await getAppointment(billing.appointment_id);
  if (appt.appointment_type !== "Clinic") {
    throw new HttpError(400, "POS payment is clinic-only.");
  }

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      billing_id: billing.id,
      appointment_id: billing.appointment_id,
      amount: billing.total,
      method,
      status: "Paid",
      paid_at: new Date().toISOString(),
      provider: "manual",
    })
    .select()
    .single<Payment>();
  if (payErr) throw payErr;

  const { data: updated, error: updErr } = await supabase
    .from("billings")
    .update({ status: "Paid" })
    .eq("id", billing.id)
    .select()
    .single<Billing>();
  if (updErr) throw updErr;

  return { billing: updated, payment };
}

export async function listBillings(actor: Actor, filters: { patient_id?: string; status?: string }) {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("billings").select("*");
  if (actor.profile.role === "patient") q = q.eq("patient_id", actor.id);
  else if (filters.patient_id) q = q.eq("patient_id", filters.patient_id);
  if (filters.status) q = q.eq("status", filters.status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data as Billing[];
}

export async function getBilling(id: string, actor: Actor) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("billings")
    .select("*, billing_items(*), payments(*)")
    .eq("id", id)
    .single();
  if (error) throw new HttpError(404, "Billing not found");
  const b = data as Billing & { billing_items: BillingItem[]; payments: Payment[] };
  if (actor.profile.role === "patient" && b.patient_id !== actor.id)
    throw new HttpError(403, "Forbidden");
  return b;
}
