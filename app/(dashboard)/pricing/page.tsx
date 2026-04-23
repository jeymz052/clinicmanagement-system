"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";

type PricingCategory = "Consultation" | "Lab" | "Medicine" | "Procedure" | "Other";

type PricingItem = {
  id: string;
  code: string;
  name: string;
  category: PricingCategory;
  price: number;
  is_active: boolean;
};

type DoctorRate = {
  id: string;
  specialty: string;
  license_no: string;
  consultation_fee_clinic: number;
  consultation_fee_online: number;
  profiles?: {
    full_name?: string;
  }[];
};

type Draft = {
  code: string;
  name: string;
  category: PricingCategory;
  price: number;
};

const EMPTY_DRAFT: Draft = {
  code: "",
  name: "",
  category: "Consultation",
  price: 0,
};

const CATEGORIES: PricingCategory[] = ["Consultation", "Lab", "Medicine", "Procedure", "Other"];

function peso(value: number) {
  return `PHP ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PricingPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const [items, setItems] = useState<PricingItem[]>([]);
  const [rates, setRates] = useState<DoctorRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [rateDraft, setRateDraft] = useState<{ clinic: number; online: number }>({ clinic: 0, online: 0 });
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [isSaving, startTransition] = useTransition();

  const canEdit = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const primaryDoctor = rates[0] ?? null;

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [pricingRes, doctorsRes] = await Promise.all([
          fetch("/api/v2/pricing?active=false", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch("/api/v2/doctors", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        if (!pricingRes.ok) throw new Error("Failed to load pricing");
        if (!doctorsRes.ok) throw new Error("Failed to load consultation fees");

        const pricingPayload = (await pricingRes.json()) as { pricing: PricingItem[] };
        const doctorsPayload = (await doctorsRes.json()) as { doctors: DoctorRate[] };

        if (active) {
          setItems(pricingPayload.pricing);
          setRates(doctorsPayload.doctors);
          const firstDoctor = doctorsPayload.doctors[0] ?? null;
          setRateDraft({
            clinic: Number(firstDoctor?.consultation_fee_clinic ?? 0),
            online: Number(firstDoctor?.consultation_fee_online ?? 0),
          });
          setError(null);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load pricing");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  const groupedByCategory = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        items: items.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [items],
  );

  const consultationItems = items.filter((item) => item.category === "Consultation");

  function resetFeedback() {
    setTimeout(() => setFeedback(null), 3500);
  }

  function addItem() {
    if (!accessToken) return;
    if (!newDraft.code || !newDraft.name) {
      setFeedback({ message: "Code and name are required.", tone: "error" });
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/v2/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(newDraft),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Add failed", tone: "error" });
        resetFeedback();
        return;
      }
      const { pricing } = (await res.json()) as { pricing: PricingItem };
      setItems((current) => [pricing, ...current]);
      setNewDraft(EMPTY_DRAFT);
      setFeedback({ message: "Pricing item added.", tone: "success" });
      resetFeedback();
    });
  }

  function beginEdit(item: PricingItem) {
    setEditingId(item.id);
    setEditDraft({ code: item.code, name: item.name, category: item.category, price: item.price });
  }

  function saveEdit() {
    if (!accessToken || !editingId) return;
    startTransition(async () => {
      const res = await fetch(`/api/v2/pricing/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(editDraft),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Update failed", tone: "error" });
        resetFeedback();
        return;
      }
      const { pricing } = (await res.json()) as { pricing: PricingItem };
      setItems((current) => current.map((item) => (item.id === pricing.id ? pricing : item)));
      setEditingId(null);
      setFeedback({ message: "Pricing item updated.", tone: "success" });
      resetFeedback();
    });
  }

  function deactivate(id: string) {
    if (!accessToken) return;
    startTransition(async () => {
      const res = await fetch(`/api/v2/pricing/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setFeedback({ message: "Deactivate failed", tone: "error" });
        resetFeedback();
        return;
      }
      setItems((current) => current.map((item) => (item.id === id ? { ...item, is_active: false } : item)));
      setFeedback({ message: "Item deactivated.", tone: "success" });
      resetFeedback();
    });
  }

  function saveConsultationRates() {
    if (!accessToken || !primaryDoctor) return;
    startTransition(async () => {
      const res = await fetch(`/api/v2/doctors/${primaryDoctor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          consultation_fee_clinic: rateDraft.clinic,
          consultation_fee_online: rateDraft.online,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Failed to update consultation rates.", tone: "error" });
        resetFeedback();
        return;
      }

      const { doctor } = (await res.json()) as { doctor: DoctorRate };
      setRates((current) => current.map((item) => (item.id === doctor.id ? { ...item, ...doctor } : item)));
      setFeedback({ message: "Consultation fees updated.", tone: "success" });
      resetFeedback();
    });
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_30%),linear-gradient(135deg,#ecfdf5_0%,#ffffff_70%)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Pricing Management</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Consultation rates and service pricing</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Manage the dedicated clinic and online consultation rates, plus the service catalog used by online payments and clinic POS billing.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <BusinessRuleCard
          title="Online Consultation"
          description="Payment is required first. The booking stays unconfirmed until the payment status becomes Paid."
        />
        <BusinessRuleCard
          title="Clinic Appointment"
          description="No upfront payment. Charges are collected only after consultation through the clinic POS workflow."
        />
        <BusinessRuleCard
          title="Pricing CRUD"
          description="Clinic staff can add, edit, and deactivate pricing so billing and payment totals stay aligned."
        />
      </section>

      {feedback ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Dedicated Rates</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Consultation fees</h2>
              <p className="mt-1 text-sm text-slate-500">
                These hourly rates are multiplied by appointment duration when consultation charges are calculated.
              </p>
            </div>
            {!canEdit ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">View only</span>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <RateCard
              label="Online Consultation Rate / Hour"
              value={peso(primaryDoctor?.consultation_fee_online ?? 0)}
              note="Used for online consultation payments based on the booked duration."
              accent="emerald"
            />
            <RateCard
              label="Clinic Consultation Rate / Hour"
              value={peso(primaryDoctor?.consultation_fee_clinic ?? 0)}
              note="Used as the clinic consultation base fee in POS based on appointment duration."
              accent="teal"
            />
          </div>

          {primaryDoctor ? (
            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Doctor Rate Source</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {primaryDoctor.profiles?.[0]?.full_name ?? "Assigned doctor"}
              </p>
              <p className="mt-1 text-sm text-slate-500">{primaryDoctor.specialty}</p>
            </div>
          ) : null}

          {canEdit && primaryDoctor ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Online consultation rate per hour
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rateDraft.online}
                  onChange={(event) => setRateDraft((current) => ({ ...current, online: Number(event.target.value) || 0 }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Clinic consultation rate per hour
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rateDraft.clinic}
                  onChange={(event) => setRateDraft((current) => ({ ...current, clinic: Number(event.target.value) || 0 }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={saveConsultationRates}
                  disabled={isSaving}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-200 disabled:text-emerald-700"
                >
                  {isSaving ? "Saving rates..." : "Save Consultation Rates"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Consultation Catalog</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Consultation pricing items</h2>
          <p className="mt-1 text-sm text-slate-500">
            Keep consultation-specific catalog items visible alongside the hourly rate cards above.
          </p>

          <div className="mt-6 space-y-3">
            {consultationItems.length > 0 ? (
              consultationItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-[1.25rem] border border-slate-200 px-4 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-700">{peso(item.price)}</p>
                    <p className={`mt-1 text-xs ${item.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                      {item.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                No consultation pricing items yet.
              </div>
            )}
          </div>
        </section>
      </div>

      {canEdit ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Add New Service Pricing</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <input
              placeholder="Code (e.g. CONS-STD)"
              value={newDraft.code}
              onChange={(e) => setNewDraft((d) => ({ ...d, code: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Name"
              value={newDraft.name}
              onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            />
            <select
              value={newDraft.category}
              onChange={(e) => setNewDraft((d) => ({ ...d, category: e.target.value as PricingCategory }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Price (PHP)"
              value={newDraft.price}
              onChange={(e) => setNewDraft((d) => ({ ...d, price: Number(e.target.value) || 0 }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              min={0}
              step="0.01"
            />
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={addItem}
              disabled={isSaving}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-teal-300"
            >
              {isSaving ? "Saving..." : "Add Item"}
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No pricing items yet. Add your first one above.</p>
        </div>
      ) : (
        groupedByCategory.map(({ category, items: categoryItems }) => (
          <div key={category} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-bold text-slate-900">{category}</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Code</th>
                  <th className="px-5 py-3 text-left font-semibold">Name</th>
                  <th className="px-5 py-3 text-right font-semibold">Price</th>
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                  {canEdit ? <th className="px-5 py-3 text-right font-semibold">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {categoryItems.map((item) => {
                  const editing = editingId === item.id;
                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-5 py-3">
                        {editing ? (
                          <input
                            value={editDraft.code}
                            onChange={(e) => setEditDraft((d) => ({ ...d, code: e.target.value }))}
                            className="rounded border border-slate-200 px-2 py-1 text-sm w-28"
                          />
                        ) : (
                          <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{item.code}</code>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {editing ? (
                          <input
                            value={editDraft.name}
                            onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                            className="rounded border border-slate-200 px-2 py-1 text-sm w-full"
                          />
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {editing ? (
                          <input
                            type="number"
                            value={editDraft.price}
                            onChange={(e) => setEditDraft((d) => ({ ...d, price: Number(e.target.value) || 0 }))}
                            className="rounded border border-slate-200 px-2 py-1 text-sm w-24 text-right"
                            min={0}
                            step="0.01"
                          />
                        ) : (
                          peso(item.price)
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canEdit ? (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-2">
                            {editing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={saveEdit}
                                  disabled={isSaving}
                                  className="rounded bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => beginEdit(item)}
                                  className="rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Edit
                                </button>
                                {item.is_active ? (
                                  <button
                                    type="button"
                                    onClick={() => deactivate(item.id)}
                                    className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                  >
                                    Deactivate
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

function BusinessRuleCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function RateCard({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent: "emerald" | "teal";
}) {
  const accentStyles = accent === "emerald" ? "text-emerald-700 bg-emerald-50" : "text-teal-700 bg-teal-50";

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-lg font-bold ${accentStyles}`}>{value}</p>
      <p className="mt-3 text-sm text-slate-500">{note}</p>
    </div>
  );
}
