import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { addBillingItems } from "@/src/lib/services/pos-billing";

/**
 * POST /api/v2/billing/{billing_id}/items
 * 
 * Add line items to a billing record
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ billing_id: string }> }
) {
  try {
    const { billing_id } = await params;
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await requireAuthenticatedUser(token);
    if (!hasPermission(user.role, "payments.pos")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
  const result = await addBillingItems(billing_id, body.items);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[billing/items]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
