import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";

type RoleKey = "doctor" | "secretary" | "patient" | "super_admin";
type RolePermissions = Record<RoleKey, Record<string, boolean>>;

const ROLE_PERMISSIONS_PATH = path.join(
  process.cwd(),
  ".data",
  "role-permissions.json",
);

async function authenticate(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? requireAuthenticatedUser(token) : null;
}

function defaultPermissions(): RolePermissions {
  return {
    doctor: {
      view_manage_appointments: true,
      set_schedule: true,
      set_unavailable_dates: true,
      add_consultation_notes: true,
      start_online_consultation: true,
      full_admin_access: true,
      manage_roles_permissions: true,
      system_configuration: true,
      handle_pos_billing: true,
    },
    secretary: {
      manage_appointments_crud: true,
      add_walkin_patients: true,
      handle_pos_billing: true,
      manage_patients: true,
    },
    patient: {
      register_login: true,
      book_appointment: true,
      choose_clinic: true,
      choose_online_consultation: true,
      pay_online_online_only: true,
    },
    super_admin: {
      full_control: true,
      manage_roles_permissions: true,
      system_configuration: true,
    },
  };
}

async function readPermissionsFile(): Promise<RolePermissions> {
  try {
    const raw = await readFile(ROLE_PERMISSIONS_PATH, "utf8");
    return JSON.parse(raw) as RolePermissions;
  } catch {
    return defaultPermissions();
  }
}

async function writePermissionsFile(payload: RolePermissions) {
  await mkdir(path.dirname(ROLE_PERMISSIONS_PATH), { recursive: true });
  await writeFile(ROLE_PERMISSIONS_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || (auth.role !== "SUPER_ADMIN" && auth.role !== "DOCTOR")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const rolePermissions = await readPermissionsFile();
  return NextResponse.json({ rolePermissions });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth || (auth.role !== "SUPER_ADMIN" && auth.role !== "DOCTOR")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { rolePermissions?: RolePermissions }
    | null;

  if (!body?.rolePermissions) {
    return NextResponse.json(
      { message: "Invalid payload. rolePermissions is required." },
      { status: 400 },
    );
  }

  await writePermissionsFile(body.rolePermissions);
  return NextResponse.json({ rolePermissions: body.rolePermissions });
}

