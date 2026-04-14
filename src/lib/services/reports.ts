import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export type RevenueReport = {
  online: number;
  clinic: number;
  total: number;
};

export type NoShowReport = {
  doctor_id: string;
  total: number;
  no_shows: number;
  rate: number;
};

export type PeakHourReport = {
  start_time: string;
  count: number;
};

export async function getRevenue(from?: string, to?: string): Promise<RevenueReport> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("payments")
    .select("amount, paid_at, appointment_id, appointments(appointment_type)")
    .eq("status", "Paid");
  if (from) q = q.gte("paid_at", from);
  if (to) q = q.lte("paid_at", to);
  const { data, error } = await q;
  if (error) throw error;

  let online = 0;
  let clinic = 0;
  for (const row of data ?? []) {
    const r = row as unknown as {
      amount: number;
      appointments?: { appointment_type: string } | { appointment_type: string }[] | null;
    };
    const joined = Array.isArray(r.appointments) ? r.appointments[0] : r.appointments;
    const type = joined?.appointment_type;
    if (type === "Online") online += Number(r.amount);
    else if (type === "Clinic") clinic += Number(r.amount);
    else clinic += Number(r.amount);
  }
  return { online, clinic, total: online + clinic };
}

export async function getNoShowRates(): Promise<NoShowReport[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("doctor_id, status")
    .in("status", ["NoShow", "Completed"]);
  if (error) throw error;

  const agg = new Map<string, { total: number; no_shows: number }>();
  for (const row of data ?? []) {
    const r = row as { doctor_id: string; status: string };
    const current = agg.get(r.doctor_id) ?? { total: 0, no_shows: 0 };
    current.total++;
    if (r.status === "NoShow") current.no_shows++;
    agg.set(r.doctor_id, current);
  }
  return [...agg.entries()].map(([doctor_id, { total, no_shows }]) => ({
    doctor_id,
    total,
    no_shows,
    rate: total ? no_shows / total : 0,
  }));
}

export async function getPeakHours(): Promise<PeakHourReport[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("start_time, status")
    .neq("status", "Cancelled");
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const r = row as { start_time: string };
    const key = r.start_time.slice(0, 5);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([start_time, count]) => ({ start_time, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getPatientVolume(from?: string, to?: string) {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("appointments")
    .select("patient_id, appointment_date, status", { count: "exact" })
    .neq("status", "Cancelled");
  if (from) q = q.gte("appointment_date", from);
  if (to) q = q.lte("appointment_date", to);
  const { data, error, count } = await q;
  if (error) throw error;
  const unique = new Set((data ?? []).map((r) => (r as { patient_id: string }).patient_id));
  return { appointments: count ?? 0, unique_patients: unique.size };
}
