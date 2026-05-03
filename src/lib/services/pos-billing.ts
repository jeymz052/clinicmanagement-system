/**
 * POS/Billing Service for Clinic Appointments
 * 
 * Handles:
 * - Creating bills after clinic consultations
 * - Adding line items (Consultation, Lab, Medicine)
 * - Recording payments (Cash, Transfer, Card)
 * - Generating receipts
 */

import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { enqueueNotification } from "@/src/lib/services/notification";
import type { PaymentMethod } from "@/src/lib/db/types";

export type BillingLineItem = {
  pricing_id?: string; // Reference to pricing table
  description: string;
  quantity: number;
  unit_price: number;
};

export type CreateBillingInput = {
  appointment_id: string;
  patient_id: string;
  items: BillingLineItem[];
  discount?: number;
  tax?: number;
};

export type RecordPaymentInput = {
  billing_id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string; // For transfers/bank deposits
};

export interface BillingRecord {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: "Draft" | "Issued" | "Paid" | "Void";
  issued_at: string | null;
  created_at: string;
}

/**
 * Create a billing record for a clinic appointment
 */
export async function createClinicBilling(input: CreateBillingInput) {
  const supabase = getSupabaseAdmin();

  try {
    // Verify appointment exists and is clinic type
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("id, appointment_type, patient_id")
      .eq("id", input.appointment_id)
      .single();

    if (apptErr || !appt) {
      throw new Error("Appointment not found");
    }

    if (appt.appointment_type !== "Clinic") {
      throw new Error("Billing only applies to clinic appointments");
    }

    // Calculate subtotal from items
    const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const discount = input.discount ?? 0;
    const tax = input.tax ?? 0;

    // Create billing record
    const { data: billing, error: billingErr } = await supabase
      .from("billings")
      .insert({
        appointment_id: input.appointment_id,
        patient_id: input.patient_id,
        subtotal,
        discount,
        tax,
        status: "Draft",
      })
      .select()
      .single<BillingRecord>();

    if (billingErr || !billing) {
      throw new Error("Failed to create billing record");
    }

    // Add line items
    const billingItems = input.items.map((item) => ({
      billing_id: billing.id,
      pricing_id: item.pricing_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsErr } = await supabase
      .from("billing_items")
      .insert(billingItems);

    if (itemsErr) {
      throw new Error("Failed to add billing items");
    }

    return {
      ok: true as const,
      billing,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Add items to an existing billing record
 */
export async function addBillingItems(
  billing_id: string,
  items: BillingLineItem[],
) {
  const supabase = getSupabaseAdmin();

  try {
    const { data: billing, error: fetchErr } = await supabase
      .from("billings")
      .select("*")
      .eq("id", billing_id)
      .single<BillingRecord>();

    if (fetchErr || !billing) {
      throw new Error("Billing record not found");
    }

    if (billing.status !== "Draft") {
      throw new Error("Can only add items to draft billings");
    }

    const billingItems = items.map((item) => ({
      billing_id,
      pricing_id: item.pricing_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsErr } = await supabase
      .from("billing_items")
      .insert(billingItems);

    if (itemsErr) {
      throw new Error("Failed to add items");
    }

    // Recalculate total
    const { data: allItems, error: getAllErr } = await supabase
      .from("billing_items")
      .select("line_total")
      .eq("billing_id", billing_id);

    if (!getAllErr && allItems) {
      const newSubtotal = allItems.reduce((sum: number, item: { line_total: number }) => sum + item.line_total, 0);
      await supabase
        .from("billings")
        .update({ subtotal: newSubtotal })
        .eq("id", billing_id);
    }

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Issue a billing (mark as Issued, ready for payment)
 */
export async function issueBilling(billing_id: string) {
  const supabase = getSupabaseAdmin();

  try {
    const { data: billing, error: fetchErr } = await supabase
      .from("billings")
      .select("*")
      .eq("id", billing_id)
      .single<BillingRecord>();

    if (fetchErr || !billing) {
      throw new Error("Billing not found");
    }

    if (billing.status !== "Draft") {
      throw new Error("Only draft billings can be issued");
    }

    const { error: updateErr } = await supabase
      .from("billings")
      .update({
        status: "Issued",
        issued_at: new Date().toISOString(),
      })
      .eq("id", billing_id);

    if (updateErr) throw updateErr;

    // Enqueue billing notification
    if (billing.appointment_id) {
      await enqueueNotification({
        user_id: billing.patient_id,
        template: "billing_issued",
        channels: ["email"],
        payload: { appointment_id: billing.appointment_id },
      });
    }

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Record a payment for a billing
 */
export async function recordClinicPayment(input: RecordPaymentInput) {
  const supabase = getSupabaseAdmin();

  try {
    const { data: billing, error: fetchErr } = await supabase
      .from("billings")
      .select("*")
      .eq("id", input.billing_id)
      .single<BillingRecord>();

    if (fetchErr || !billing) {
      throw new Error("Billing not found");
    }

    if (billing.status !== "Issued") {
      throw new Error("Only issued billings can accept payments");
    }

    // Create payment record
    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .insert({
        billing_id: input.billing_id,
        amount: input.amount,
        method: input.method,
        provider_ref: input.reference,
        status: "Paid",
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentErr || !payment) {
      throw new Error("Failed to record payment");
    }

    // Update billing status
    const { error: updateErr } = await supabase
      .from("billings")
      .update({ status: "Paid" })
      .eq("id", input.billing_id);

    if (updateErr) throw updateErr;

    return {
      ok: true as const,
      payment,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get billing details with items and payment
 */
export async function getBillingDetails(billing_id: string) {
  const supabase = getSupabaseAdmin();

  try {
    const { data: billing, error: billingErr } = await supabase
      .from("billings")
      .select("*")
      .eq("id", billing_id)
      .single<BillingRecord>();

    if (billingErr || !billing) {
      throw new Error("Billing not found");
    }

    const { data: items, error: itemsErr } = await supabase
      .from("billing_items")
      .select("*")
      .eq("billing_id", billing_id);

    if (itemsErr) throw itemsErr;

    const { data: payments, error: paymentsErr } = await supabase
      .from("payments")
      .select("*")
      .eq("billing_id", billing_id);

    if (paymentsErr) throw paymentsErr;

    return {
      ok: true as const,
      billing,
      items: items ?? [],
      payments: payments ?? [],
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate receipt data for printing/email
 */
export async function generateReceipt(billing_id: string) {
  const result = await getBillingDetails(billing_id);

  if (!result.ok) {
    return result;
  }

  const { billing, items, payments } = result;

  // Get patient info
  const supabase = getSupabaseAdmin();
  const { data: patient } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", billing.patient_id)
    .single();

  const receipt = {
    id: billing.id,
    issued_at: billing.issued_at,
    patient_name: patient?.full_name || "N/A",
    patient_email: patient?.email || "N/A",
    patient_phone: patient?.phone || "N/A",
    items: items.map((item: any) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.line_total,
    })),
    subtotal: billing.subtotal,
    discount: billing.discount,
    tax: billing.tax,
    total: billing.total,
    payments: payments.map((p: any) => ({
      method: p.method,
      amount: p.amount,
      date: p.paid_at,
      reference: p.provider_ref,
    })),
  };

  return {
    ok: true as const,
    receipt,
  };
}
