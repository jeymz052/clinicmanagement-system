"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { DbRole, Profile } from "@/src/lib/db/types";

type CreateUserForm = {
  email: string;
  full_name: string;
  phone: string;
  role: "super_admin" | "secretary" | "doctor";
  doctor_specialty: string;
  doctor_license_no: string;
  doctor_fee_clinic: string;
  doctor_fee_online: string;
};

const EMPTY_NEW_USER: CreateUserForm = {
  email: "",
  full_name: "",
  phone: "",
  role: "secretary",
  doctor_specialty: "",
  doctor_license_no: "",
  doctor_fee_clinic: "0",
  doctor_fee_online: "0",
};

function roleLabel(role: DbRole) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "secretary":
      return "Secretary";
    case "doctor":
      return "Doctor";
    case "patient":
      return "Patient";
    case "admin":
      return "Admin";
    default:
      return role;
  }
}

export default function UsersPage() {
  const { role, accessToken, isLoading: authLoading } = useRole();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<DbRole | "all">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState<CreateUserForm>(EMPTY_NEW_USER);
  const [lastTempPassword, setLastTempPassword] = useState<string | null>(null);
  const [isMutating, startTransition] = useTransition();

  const canManage = role === "SUPER_ADMIN";

  const filtered = useMemo(() => {
    let result = users;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q),
      );
    }
    if (filterRole !== "all") {
      result = result.filter((u) => u.role === filterRole);
    }
    if (filterActive === "active") result = result.filter((u) => u.is_active);
    if (filterActive === "inactive") result = result.filter((u) => !u.is_active);
    return result;
  }, [filterActive, filterRole, query, users]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v2/users", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? "Failed to load users");
        }
        const payload = (await res.json()) as { users: Profile[] };
        if (active) setUsers(payload.users ?? []);
      } catch (e) {
        if (active) {
          setFeedback({
            type: "error",
            message: e instanceof Error ? e.message : "Failed to load users",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  function closeModal() {
    setShowAddModal(false);
    setNewUser(EMPTY_NEW_USER);
    setLastTempPassword(null);
  }

  function submitNewUser(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setFeedback(null);

    startTransition(async () => {
      try {
        const body =
          newUser.role === "doctor"
            ? {
                email: newUser.email,
                full_name: newUser.full_name,
                phone: newUser.phone || null,
                role: newUser.role,
                doctor: {
                  specialty: newUser.doctor_specialty,
                  license_no: newUser.doctor_license_no,
                  consultation_fee_clinic: Number(newUser.doctor_fee_clinic || 0),
                  consultation_fee_online: Number(newUser.doctor_fee_online || 0),
                },
              }
            : {
                email: newUser.email,
                full_name: newUser.full_name,
                phone: newUser.phone || null,
                role: newUser.role,
              };

        const res = await fetch("/api/v2/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message ?? "Unable to create user.");
        }

        const created = (await res.json()) as { user_id: string; temp_password: string };
        setLastTempPassword(created.temp_password);
        setFeedback({
          type: "success",
          message: "User created. Copy the temporary password and share it securely.",
        });

        // Refresh list
        const reload = await fetch("/api/v2/users", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = (await reload.json()) as { users: Profile[] };
        setUsers(payload.users ?? []);
      } catch (e) {
        setFeedback({
          type: "error",
          message: e instanceof Error ? e.message : "Unable to create user.",
        });
      }
    });
  }

  function toggleActive(user: Profile) {
    if (!accessToken) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v2/users/${user.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ is_active: !user.is_active }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message ?? "Unable to update user");
        }
        const payload = (await res.json()) as { user: Profile };
        setUsers((prev) => prev.map((u) => (u.id === payload.user.id ? payload.user : u)));
      } catch (e) {
        setFeedback({
          type: "error",
          message: e instanceof Error ? e.message : "Unable to update user",
        });
      }
    });
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Forbidden. Only Super Admin can manage users.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 animate-fade-in-down">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Users
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Create and manage staff accounts (Doctor / Secretary / Super Admin).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setShowAddModal(true);
          }}
          className="rounded-xl bg-teal-700 px-5 py-2.5 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-teal-800 hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          + Add user
        </button>
      </div>

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email or name..."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div className="w-full md:w-56">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as DbRole | "all")}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400"
              >
                <option value="all">All</option>
                <option value="super_admin">Super Admin</option>
                <option value="secretary">Secretary</option>
                <option value="doctor">Doctor</option>
                <option value="patient">Patient</option>
              </select>
            </div>
            <div className="w-full md:w-56">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as typeof filterActive)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {loading ? "Loading..." : `${filtered.length} user(s)`}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md hover-lift animate-fade-in-up">
        <table className="w-full text-left text-base">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700">UID</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Display name</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Email</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Phone</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Role</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            ) : null}
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-t border-slate-200 align-top transition-all duration-150 hover:bg-teal-50/40"
              >
                <td className="px-6 py-4">
                  <span className="font-mono text-xs text-slate-600">{u.id}</span>
                </td>
                <td className="px-6 py-4">
                  <p className="font-semibold text-slate-900">{u.full_name}</p>
                </td>
                <td className="px-6 py-4 text-slate-700">{u.email}</td>
                <td className="px-6 py-4 text-slate-700">{u.phone ?? "-"}</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {roleLabel(u.role)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      u.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => toggleActive(u)}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 ${
                      u.is_active
                        ? "border-red-200 text-red-700 hover:bg-red-50 focus:ring-red-200"
                        : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-200"
                    }`}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Add user</h2>
                <p className="text-sm text-slate-500">
                  A temporary password will be generated for the new user.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {lastTempPassword ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Temporary password</p>
                <p className="mt-1 font-mono break-all">{lastTempPassword}</p>
                <p className="mt-2 text-xs text-amber-800">
                  Share this securely. The user should change it after first login.
                </p>
              </div>
            ) : null}

            <form onSubmit={submitNewUser} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full name
                  </label>
                  <input
                    value={newUser.full_name}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, full_name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, email: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone (optional)
                  </label>
                  <input
                    value={newUser.phone}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, phone: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="+63..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser((p) => ({
                        ...p,
                        role: e.target.value as CreateUserForm["role"],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="secretary">Secretary</option>
                    <option value="doctor">Doctor</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              {newUser.role === "doctor" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800 mb-3">
                    Doctor details
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Specialty
                      </label>
                      <input
                        value={newUser.doctor_specialty}
                        onChange={(e) =>
                          setNewUser((p) => ({
                            ...p,
                            doctor_specialty: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        License No.
                      </label>
                      <input
                        value={newUser.doctor_license_no}
                        onChange={(e) =>
                          setNewUser((p) => ({
                            ...p,
                            doctor_license_no: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Clinic fee (PHP)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={newUser.doctor_fee_clinic}
                        onChange={(e) =>
                          setNewUser((p) => ({
                            ...p,
                            doctor_fee_clinic: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Online fee (PHP)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={newUser.doctor_fee_online}
                        onChange={(e) =>
                          setNewUser((p) => ({
                            ...p,
                            doctor_fee_online: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-teal-300"
                >
                  {isMutating ? "Creating..." : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

