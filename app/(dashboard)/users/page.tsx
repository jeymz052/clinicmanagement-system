"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { DbRole, Profile } from "@/src/lib/db/types";

type CreateUserForm = {
  email: string;
  full_name: string;
  phone: string;
  role: "super_admin" | "secretary" | "doctor";
};
type EditUserForm = {
  full_name: string;
  phone: string;
  role: DbRole;
  is_active: boolean;
};
type UserManagementTab = "accounts" | "roles";
type RoleKey = "doctor" | "secretary" | "patient" | "super_admin";
type PermissionItem = {
  key: string;
  label: string;
};

const EMPTY_NEW_USER: CreateUserForm = {
  email: "",
  full_name: "",
  phone: "",
  role: "secretary",
};

function profileToEditForm(user: Profile): EditUserForm {
  return {
    full_name: user.full_name,
    phone: user.phone ?? "",
    role: user.role,
    is_active: user.is_active,
  };
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const ROLE_PERMISSION_CATALOG: Record<RoleKey, PermissionItem[]> = {
  doctor: [
    { key: "view_manage_appointments", label: "View & manage appointments" },
    { key: "set_schedule", label: "Set schedule" },
    { key: "set_unavailable_dates", label: "Set unavailable dates" },
    { key: "add_consultation_notes", label: "Add consultation notes" },
    { key: "start_online_consultation", label: "Start online consultation" },
    { key: "full_admin_access", label: "Full admin access" },
    { key: "handle_pos_billing", label: "Handle POS billing" },
  ],
  secretary: [
    { key: "manage_appointments_crud", label: "Manage appointments (CRUD)" },
    { key: "add_walkin_patients", label: "Add walk-in patients" },
    { key: "handle_pos_billing", label: "Handle POS billing" },
    { key: "manage_patients", label: "Manage patients" },
  ],
  patient: [
    { key: "register_login", label: "Register / login" },
    { key: "book_appointment", label: "Book appointment" },
    { key: "choose_clinic", label: "Choose clinic" },
    { key: "choose_online_consultation", label: "Choose online consultation" },
    { key: "pay_online_online_only", label: "Pay online (online consult only)" },
  ],
  super_admin: [
    { key: "full_control", label: "Full control" },
    { key: "manage_roles_permissions", label: "Manage roles & permissions" },
    { key: "system_configuration", label: "System configuration" },
  ],
};

const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, Record<string, boolean>> =
  Object.fromEntries(
    Object.entries(ROLE_PERMISSION_CATALOG).map(([roleName, items]) => [
      roleName,
      Object.fromEntries(items.map((item) => [item.key, true])),
    ]),
  ) as Record<RoleKey, Record<string, boolean>>;

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
  const { role, user: sessionUser, accessToken, isLoading: authLoading } = useRole();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<DbRole | "all">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editUser, setEditUser] = useState<EditUserForm>({
    full_name: "",
    phone: "",
    role: "secretary",
    is_active: true,
  });
  const [activeTab, setActiveTab] = useState<UserManagementTab>("accounts");
  const [newUser, setNewUser] = useState<CreateUserForm>(EMPTY_NEW_USER);
  const [isMutating, startTransition] = useTransition();
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [emailCheck, setEmailCheck] = useState<{
    status: "idle" | "checking" | "available" | "duplicate" | "error";
    message?: string;
  }>({ status: "idle" });
  const [resultDialog, setResultDialog] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    tempPassword?: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [savedRolePermissions, setSavedRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const submitLockRef = useRef(false);
  const editSubmitLockRef = useRef(false);

  const canManage = role === "SUPER_ADMIN";
  const currentUserId = sessionUser?.id ?? null;

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

  const activeUsers = users.filter((u) => u.is_active).length;
  const doctorUsers = users.filter((u) => u.role === "doctor").length;
  const secretaryUsers = users.filter((u) => u.role === "secretary").length;
  const superAdminUsers = users.filter((u) => u.role === "super_admin").length;
  const patientUsers = users.filter((u) => u.role === "patient").length;
  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStart = filteredCount === 0 ? 0 : (currentPageSafe - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPageSafe * pageSize, filteredCount);
  const paginatedUsers = useMemo(() => {
    const start = (currentPageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPageSafe, pageSize]);
  const rolesDirty = useMemo(
    () => JSON.stringify(rolePermissions) !== JSON.stringify(savedRolePermissions),
    [rolePermissions, savedRolePermissions],
  );
  const allVisibleSelected =
    paginatedUsers.length > 0 &&
    paginatedUsers.every((userItem) => selectedUserIds.includes(userItem.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filterRole, filterActive, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      setSavedRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/v2/role-permissions", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          rolePermissions?: Record<RoleKey, Record<string, boolean>>;
        };
        const merged = {
          ...DEFAULT_ROLE_PERMISSIONS,
          ...(payload.rolePermissions ?? {}),
        };
        if (active) {
          setRolePermissions(merged);
          setSavedRolePermissions(merged);
        }
      } catch {
        // Keep defaults when endpoint is unavailable.
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

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

  useEffect(() => {
    setSelectedUserIds([]);
  }, [currentPageSafe, filterActive, filterRole, query, pageSize]);

  function closeModal() {
    setShowAddModal(false);
    setNewUser(EMPTY_NEW_USER);
    setEmailCheck({ status: "idle" });
  }

  function closeEditModal() {
    setShowEditModal(false);
    setEditingUser(null);
    setEditUser({
      full_name: "",
      phone: "",
      role: "secretary",
      is_active: true,
    });
  }

  function openEditModal(user: Profile) {
    setFeedback(null);
    setEditingUser(user);
    setEditUser(profileToEditForm(user));
    setShowEditModal(true);
  }

  async function patchUser(userId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/v2/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? "Unable to update user");
    }
    return (await res.json()) as { user: Profile };
  }

  function submitEditUser(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !editingUser || editSubmitLockRef.current || isMutating) return;
    editSubmitLockRef.current = true;
    setFeedback(null);

    startTransition(async () => {
      try {
        const before = profileToEditForm(editingUser);
        const payload: Record<string, unknown> = {};
        if (editUser.full_name.trim() !== before.full_name.trim()) {
          payload.full_name = editUser.full_name.trim();
        }
        const nextPhone = editUser.phone.trim() || null;
        const prevPhone = before.phone.trim() || null;
        if (nextPhone !== prevPhone) {
          payload.phone = nextPhone;
        }
        if (editUser.role !== before.role) {
          payload.role = editUser.role;
        }
        if (editUser.is_active !== before.is_active) {
          if (currentUserId === editingUser.id && editUser.is_active === false) {
            setEditUser((p) => ({ ...p, is_active: true }));
          } else {
            payload.is_active = editUser.is_active;
          }
        }

        if (currentUserId === editingUser.id && payload.is_active === false) {
          throw new Error("You cannot deactivate your own account.");
        }

        if (Object.keys(payload).length === 0) {
          setFeedback({ type: "success", message: "No changes to save." });
          closeEditModal();
          return;
        }

        const { user: updated } = await patchUser(editingUser.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setFeedback({ type: "success", message: "User updated successfully." });
        setResultDialog({
          type: "success",
          title: "User updated",
          message: `${updated.full_name}'s profile was saved.`,
        });
        closeEditModal();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to update user.";
        setFeedback({ type: "error", message });
        setResultDialog({
          type: "error",
          title: "Unable to update user",
          message,
        });
      } finally {
        editSubmitLockRef.current = false;
      }
    });
  }

  function exportSelectedUsersCsv() {
    const rows = users.filter((u) => selectedUserIds.includes(u.id));
    if (rows.length === 0) return;
    const header = ["id", "full_name", "email", "phone", "role", "is_active", "created_at"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...rows.map((u) =>
        [
          u.id,
          u.full_name,
          u.email,
          u.phone ?? "",
          u.role,
          u.is_active ? "true" : "false",
          u.created_at,
        ]
          .map((cell) => escape(String(cell)))
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ type: "success", message: `Exported ${rows.length} user(s).` });
  }

  function bulkSetActive(targetActive: boolean) {
    if (!accessToken || selectedUserIds.length === 0) return;
    setFeedback(null);
    startTransition(async () => {
      const ids = [...selectedUserIds];
      const skippedSelf =
        targetActive === false && currentUserId ? ids.filter((id) => id === currentUserId) : [];
      const toPatch = ids.filter((id) => !(targetActive === false && id === currentUserId));
      let okCount = 0;
      const errors: string[] = [];
      for (const id of toPatch) {
        const user = users.find((u) => u.id === id);
        if (!user || user.is_active === targetActive) continue;
        try {
          const { user: updated } = await patchUser(id, { is_active: targetActive });
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          okCount += 1;
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "Update failed");
        }
      }
      setSelectedUserIds([]);
      const parts = [`Updated ${okCount} user(s).`];
      if (skippedSelf.length) {
        parts.push("Skipped your own account (cannot deactivate yourself).");
      }
      if (errors.length) {
        parts.push(`${errors.length} error(s): ${errors.slice(0, 2).join("; ")}`);
      }
      setFeedback({
        type: errors.length ? "error" : "success",
        message: parts.join(" "),
      });
    });
  }

  async function checkEmailDuplicate(rawEmail: string) {
    if (!accessToken) {
      return { duplicate: false, normalizedEmail: rawEmail.trim().toLowerCase() };
    }
    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      return { duplicate: false, normalizedEmail };
    }

    const existingUserRes = await fetch("/api/v2/users", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!existingUserRes.ok) {
      const err = (await existingUserRes.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? "Unable to validate user email.");
    }
    const existingPayload = (await existingUserRes.json()) as { users: Profile[] };
    const duplicate = (existingPayload.users ?? []).some(
      (userItem) => userItem.email.toLowerCase() === normalizedEmail,
    );
    return { duplicate, normalizedEmail };
  }

  async function validateEmailAvailability(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailCheck({ status: "idle" });
      return false;
    }

    setEmailCheck({ status: "checking", message: "Checking if email already exists..." });
    try {
      const { duplicate } = await checkEmailDuplicate(email);
      if (duplicate) {
        setEmailCheck({
          status: "duplicate",
          message: "This email is already registered. Use a different email.",
        });
        return false;
      }
      setEmailCheck({ status: "available", message: "Email is available." });
      return true;
    } catch (e) {
      setEmailCheck({
        status: "error",
        message: e instanceof Error ? e.message : "Unable to validate email.",
      });
      return false;
    }
  }

  function submitNewUser(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || submitLockRef.current || isMutating || isCheckingDuplicate) return;
    setFeedback(null);
    submitLockRef.current = true;

    startTransition(async () => {
      try {
        const normalizedEmail = newUser.email.trim().toLowerCase();
        if (!normalizedEmail) {
          throw new Error("Email is required.");
        }

        setIsCheckingDuplicate(true);
        const { duplicate: alreadyExists } = await checkEmailDuplicate(newUser.email);
        if (alreadyExists) {
          setEmailCheck({
            status: "duplicate",
            message: "This email is already registered. Use a different email.",
          });
          throw new Error("This email is already registered. Use a different email.");
        }
        setEmailCheck({ status: "available", message: "Email is available." });

        const body = {
          email: normalizedEmail,
          full_name: newUser.full_name.trim(),
          phone: newUser.phone.trim() || null,
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
        setFeedback({
          type: "success",
          message: "User created. Copy the temporary password and share it securely.",
        });
        setResultDialog({
          type: "success",
          title: "User created successfully",
          message: "The account is ready. Share the temporary password securely.",
          tempPassword: created.temp_password,
        });
        closeModal();

        // Refresh list
        const reload = await fetch("/api/v2/users", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = (await reload.json()) as { users: Profile[] };
        setUsers(payload.users ?? []);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to create user.";
        setFeedback({
          type: "error",
          message,
        });
        setResultDialog({
          type: "error",
          title: "Unable to create user",
          message,
        });
      } finally {
        submitLockRef.current = false;
        setIsCheckingDuplicate(false);
      }
    });
  }

  function toggleActive(user: Profile) {
    if (!accessToken) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const { user: updated } = await patchUser(user.id, { is_active: !user.is_active });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } catch (e) {
        setFeedback({
          type: "error",
          message: e instanceof Error ? e.message : "Unable to update user",
        });
      }
    });
  }

  function setPermission(roleKey: RoleKey, permissionKey: string, enabled: boolean) {
    setRolePermissions((prev) => ({
      ...prev,
      [roleKey]: {
        ...prev[roleKey],
        [permissionKey]: enabled,
      },
    }));
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedUserIds((prev) =>
        prev.filter((id) => !paginatedUsers.some((userItem) => userItem.id === id)),
      );
      return;
    }
    setSelectedUserIds((prev) => [
      ...new Set([...prev, ...paginatedUsers.map((userItem) => userItem.id)]),
    ]);
  }

  function resetRolePermissions() {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
  }

  function saveRolePermissions() {
    if (!accessToken) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/v2/role-permissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ rolePermissions }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message ?? "Failed to save role permissions.");
        }
        const payload = (await res.json()) as {
          rolePermissions: Record<RoleKey, Record<string, boolean>>;
        };
        setRolePermissions(payload.rolePermissions);
        setSavedRolePermissions(payload.rolePermissions);
        setFeedback({
          type: "success",
          message: "Roles and permissions saved successfully.",
        });
        setResultDialog({
          type: "success",
          title: "Permissions updated",
          message: "Role permissions have been saved.",
        });
      } catch (e) {
        setFeedback({
          type: "error",
          message: e instanceof Error ? e.message : "Failed to save role permissions.",
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
            User management
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Manage user accounts, roles, and access permissions.
          </p>
        </div>
        {activeTab === "accounts" ? (
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
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("accounts")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "accounts"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            User accounts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "roles"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Roles & permissions
          </button>
        </div>
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

      {activeTab === "accounts" ? (
        <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Active users</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{activeUsers}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Doctors</p>
          <p className="mt-1 text-2xl font-bold text-sky-800">{doctorUsers}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Secretary</p>
          <p className="mt-1 text-2xl font-bold text-violet-800">{secretaryUsers}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Patients</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{patientUsers}</p>
        </div>
      </div>

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
            <div className="w-full md:w-40">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Per page
              </label>
              <select
                value={pageSize}
                onChange={(e) =>
                  setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
              {selectedUserIds.length} selected
            </div>
            {selectedUserIds.length > 0 ? (
              <>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => bulkSetActive(true)}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                >
                  Activate selected
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => bulkSetActive(false)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                  Deactivate selected
                </button>
                <button
                  type="button"
                  onClick={exportSelectedUsersCsv}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Export CSV
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilterRole("all");
                setFilterActive("all");
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset filters
            </button>
            <div className="text-xs text-slate-500">
              {loading ? "Loading..." : `${filtered.length} user(s)`}
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-3 animate-fade-in-up">
        {!loading && paginatedUsers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400 shadow-sm">
            No users found.
          </div>
        ) : null}
        {paginatedUsers.map((u) => (
          <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <label className="pt-0.5">
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(u.id)}
                  onChange={() => toggleUserSelection(u.id)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  aria-label={`Select ${u.full_name}`}
                />
              </label>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{u.full_name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-600">{u.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  u.is_active
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {u.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <p className="text-slate-500">Role</p>
                <p className="mt-0.5 font-medium text-slate-800">{roleLabel(u.role)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <p className="text-slate-500">Phone</p>
                <p className="mt-0.5 font-medium text-slate-800">{u.phone ?? "-"}</p>
              </div>
            </div>
            <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2">
              <p className="text-[11px] text-slate-500">UID</p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-700">{u.id}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isMutating}
                onClick={() => openEditModal(u)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => toggleActive(u)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 ${
                  u.is_active
                    ? "border-red-200 text-red-700 hover:bg-red-50 focus:ring-red-200"
                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-200"
                }`}
              >
                {u.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md hover-lift animate-fade-in-up md:block">
        <table className="w-full text-left text-base">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  aria-label="Select all visible users"
                />
              </th>
              <th className="px-6 py-4 font-semibold text-slate-700">User profile</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Email</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Phone</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Role</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Registered</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            ) : null}
            {paginatedUsers.map((u) => (
              <tr
                key={u.id}
                className="border-t border-slate-200 align-top transition-all duration-150 hover:bg-teal-50/40"
              >
                <td className="px-4 py-4 align-middle">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(u.id)}
                    onChange={() => toggleUserSelection(u.id)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    aria-label={`Select ${u.full_name}`}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                      {u.full_name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() ?? "")
                        .join("") || "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{u.full_name}</p>
                      <p className="truncate text-xs text-slate-500">{u.id}</p>
                    </div>
                  </div>
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
                  <span className="text-sm text-slate-600">
                    {new Date(u.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => openEditModal(u)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Edit
                    </button>
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading users..."
              : filteredCount === 0
                ? "No users to display"
                : `Showing ${pageStart}-${pageEnd} of ${filteredCount} users`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPageSafe === 1 || loading}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Page {currentPageSafe} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPageSafe >= totalPages || loading}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      </>
      ) : null}

      {activeTab === "roles" ? (
        <div className="space-y-4 animate-fade-in-up">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">System roles and permissions</h2>
            <p className="mt-1 text-sm text-slate-600">
              Access is defined here and managed under User Management, not in a separate submenu.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">
              Toggle permissions per role, then save changes.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetRolePermissions}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={saveRolePermissions}
                disabled={!rolesDirty || isMutating}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMutating ? "Saving..." : "Save permissions"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(
              [
                ["doctor", "Doctor", "border-sky-200 bg-sky-50/40 text-sky-900"],
                ["secretary", "Secretary / Admin Staff", "border-emerald-200 bg-emerald-50/40 text-emerald-900"],
                ["patient", "Patient", "border-amber-200 bg-amber-50/40 text-amber-900"],
                ["super_admin", "Super Admin", "border-violet-200 bg-violet-50/40 text-violet-900"],
              ] as const
            ).map(([roleKey, roleTitle, colorClass]) => (
              <div key={roleKey} className={`rounded-2xl border p-5 shadow-sm ${colorClass}`}>
                <h3 className="text-base font-bold">{roleTitle}</h3>
                <div className="mt-3 space-y-2">
                  {ROLE_PERMISSION_CATALOG[roleKey].map((permission) => (
                    <label
                      key={permission.key}
                      className="flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(rolePermissions[roleKey][permission.key])}
                        onChange={(e) => setPermission(roleKey, permission.key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>{permission.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Current account distribution
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Doctors</p>
                <p className="text-lg font-bold text-slate-900">{doctorUsers}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Secretaries</p>
                <p className="text-lg font-bold text-slate-900">{secretaryUsers}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Super Admins</p>
                <p className="text-lg font-bold text-slate-900">{superAdminUsers}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Patients</p>
                <p className="text-lg font-bold text-slate-900">{patientUsers}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-teal-50 to-emerald-50 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create a new user</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Fill in details, verify email availability, then create the account.
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

            <div className="px-6 py-5">
            <form onSubmit={submitNewUser} className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-800">Basic account information</p>
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
                    placeholder="e.g. Esteban James"
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
                    onChange={(e) => {
                      setNewUser((p) => ({ ...p, email: e.target.value }));
                      setEmailCheck({ status: "idle" });
                    }}
                    onBlur={() => {
                      void validateEmailAvailability(newUser.email);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="name@email.com"
                    required
                  />
                  {emailCheck.status !== "idle" ? (
                    <p
                      className={`mt-1 text-xs ${
                        emailCheck.status === "available"
                          ? "text-emerald-700"
                          : emailCheck.status === "checking"
                            ? "text-slate-500"
                            : "text-red-600"
                      }`}
                    >
                      {emailCheck.message}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      This email will be validated before submit to prevent duplicates.
                    </p>
                  )}
                </div>
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

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating || isCheckingDuplicate || emailCheck.status === "duplicate"}
                  className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-teal-300"
                >
                  {isCheckingDuplicate ? "Checking email..." : isMutating ? "Creating..." : "Create user"}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      ) : null}

      {showEditModal && editingUser ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Edit user</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Update profile details and role. Email cannot be changed here.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close edit modal"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Email: </span>
                {editingUser.email}
              </p>
              <form onSubmit={submitEditUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
                  <input
                    value={editUser.full_name}
                    onChange={(e) => setEditUser((p) => ({ ...p, full_name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    value={editUser.phone}
                    onChange={(e) => setEditUser((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="+63..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={editUser.role}
                    onChange={(e) =>
                      setEditUser((p) => ({ ...p, role: e.target.value as DbRole }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="secretary">Secretary</option>
                    <option value="doctor">Doctor</option>
                    <option value="patient">Patient</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editUser.is_active}
                    onChange={(e) => setEditUser((p) => ({ ...p, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Account active
                </label>
                {currentUserId === editingUser.id && !editUser.is_active ? (
                  <p className="text-xs text-amber-700">
                    You cannot deactivate your own account. Unchecking will be ignored on save.
                  </p>
                ) : null}
                <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isMutating}
                    className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-teal-300"
                  >
                    {isMutating ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {resultDialog ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div
              className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                resultDialog.type === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {resultDialog.type === "success" ? "Success" : "Error"}
            </div>
            <h3 className="text-lg font-bold text-slate-900">{resultDialog.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{resultDialog.message}</p>
            {resultDialog.tempPassword ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">Temporary password</p>
                <p className="mt-1 break-all font-mono text-sm text-amber-950">
                  {resultDialog.tempPassword}
                </p>
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              {resultDialog.tempPassword ? (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(resultDialog.tempPassword ?? "");
                    setFeedback({
                      type: "success",
                      message: "Temporary password copied to clipboard.",
                    });
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Copy password
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setResultDialog(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

