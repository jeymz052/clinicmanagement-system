"use client";

import { useEffect, useState, useTransition } from "react";
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

export default function PricingPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [isSaving, startTransition] = useTransition();

  const canEdit = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v2/pricing?active=false", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load pricing");
        const payload = (await res.json()) as { pricing: PricingItem[] };
        if (active) {
          setItems(payload.pricing);
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
      setItems((current) => current.map((it) => (it.id === pricing.id ? pricing : it)));
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
      setItems((current) => current.map((it) => (it.id === id ? { ...it, is_active: false } : it)));
      setFeedback({ message: "Item deactivated.", tone: "success" });
      resetFeedback();
    });
  }

  const groupedByCategory = CATEGORIES.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Pricing</h1>
        <p className="mt-1 text-sm text-slate-500">Manage consultation, lab, medicine, and procedure rates.</p>
      </div>

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

      {canEdit ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Add New Item</h2>
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
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Price (PHP)"
              value={newDraft.price}
              onChange={(e) => setNewDraft((d) => ({ ...d, price: Number(e.target.value) }))}
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
        </div>
      ) : null}

      {loading ? (
        <div className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No pricing items yet. Add your first one above.</p>
        </div>
      ) : (
        groupedByCategory.map(({ category, items: catItems }) => (
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
                {catItems.map((item) => {
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
                            onChange={(e) => setEditDraft((d) => ({ ...d, price: Number(e.target.value) }))}
                            className="rounded border border-slate-200 px-2 py-1 text-sm w-24 text-right"
                            min={0}
                            step="0.01"
                          />
                        ) : (
                          `₱${Number(item.price).toLocaleString()}`
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
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
