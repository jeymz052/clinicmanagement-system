import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor, isStaff } from "@/src/lib/http";
import type {
  Billing,
  BillingStatus,
  BillingItem,
  Payment,
  PaymentMethod,
} from "@/src/lib/db/types";
import { getAppointment, getDoctor } from "@/src/lib/services/booking";
import { enqueueNotification } from "@/src/lib/services/notification";
import {
  calculateConsultationCharge,
  formatDurationLabel,
  normalizeConfiguredConsultationRate,
} from "@/src/lib/consultation-pricing";

export type BillingItemInput = {
  pricing_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

const ALLOWED_BILLING_STATUSES = new Set<BillingStatus>(["Draft", "Issued", "Paid", "Void"]);

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
  if (appt.status !== "InProgress" && appt.status !== "Completed")
    throw new HttpError(400, "Generate the clinic bill after consultation starts.");

  const supabase = getSupabaseAdmin();
  const { data: existingBilling } = await supabase
    .from("billings")
    .select("id, status")
    .eq("appointment_id", appt.id)
    .in("status", ["Draft", "Issued", "Paid"])
    .maybeSingle<{ id: string; status: BillingStatus }>();
  if (existingBilling) {
    throw new HttpError(400, "A clinic POS bill already exists for this appointment.");
  }

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
  const consultationHourlyRate = normalizeConfiguredConsultationRate(
    Number(doctor.consultation_fee_clinic),
  );
  const consultationLine = {
    pricing_id: null,
    description: `Clinic consultation (${formatDurationLabel(appt.start_time, appt.end_time)} @ PHP ${consultationHourlyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/hr)`,
    quantity: 1,
    unit_price: calculateConsultationCharge(
      consultationHourlyRate,
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
  providerRef: string | null,
  actor: Actor,
): Promise<{ billing: Billing; payment: Payment }> {
  if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor")
    throw new HttpError(403, "Only clinic staff or doctors can record POS payments");
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
      provider_ref: providerRef,
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

  if (appt.status !== "Completed") {
    const { error: apptUpdateError } = await supabase
      .from("appointments")
      .update({ status: "Completed" })
      .eq("id", appt.id);
    if (apptUpdateError) throw apptUpdateError;
  }

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

export async function updateBilling(
  id: string,
  input: {
    discount?: number;
    tax?: number;
    status?: BillingStatus;
    items?: BillingItemInput[];
  },
  actor: Actor,
) {
  if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor") {
    throw new HttpError(403, "Forbidden");
  }

  const current = await getBilling(id, actor);
  const supabase = getSupabaseAdmin();
  if (current.status === "Paid") {
    throw new HttpError(400, "Paid bills can no longer be edited.");
  }

  const nextItems = (input.items ?? current.billing_items).map((item) => {
    const description = item.description.trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);

    if (!description) throw new HttpError(400, "Each billing item needs a description.");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new HttpError(400, "Quantity must be greater than zero.");
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new HttpError(400, "Unit price must be zero or greater.");
    }

    return {
      pricing_id: "pricing_id" in item ? item.pricing_id ?? null : null,
      description,
      quantity,
      unit_price: unitPrice,
    };
  });

  const discount = input.discount != null ? Number(input.discount) : Number(current.discount);
  const tax = input.tax != null ? Number(input.tax) : Number(current.tax);
  if (!Number.isFinite(discount) || discount < 0) throw new HttpError(400, "Discount must be zero or greater.");
  if (!Number.isFinite(tax) || tax < 0) throw new HttpError(400, "Tax must be zero or greater.");

  const status = input.status ?? current.status;
  if (!ALLOWED_BILLING_STATUSES.has(status)) {
    throw new HttpError(400, "Invalid billing status.");
  }

  const subtotal = nextItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const { error: updateError } = await supabase
    .from("billings")
    .update({
      subtotal,
      discount,
      tax,
      status,
    })
    .eq("id", id);
  if (updateError) throw updateError;

  if (input.items) {
    const { error: deleteError } = await supabase.from("billing_items").delete().eq("billing_id", id);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("billing_items").insert(
      nextItems.map((item) => ({
        billing_id: id,
        pricing_id: item.pricing_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    );
    if (insertError) throw insertError;
  }

  return getBilling(id, actor);
}
