import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { issueBilling, recordClinicPayment, generateReceipt } from "@/src/lib/services/pos-billing";

/**
 * POST /api/v2/billing/{billing_id}/issue
 * 
 * Issue a billing (mark as Issued)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ billing_id: string }> }
) {
  const { billing_id } = await params;
  const pathname = request.nextUrl.pathname;

  // Handle /issue endpoint
  if (pathname.includes("/issue")) {
    try {
      const token = request.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = await requireAuthenticatedUser(token);
      if (!hasPermission(user.role, "payments.pos")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const result = await issueBilling(billing_id);

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing/issue]", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Handle /payment endpoint
  if (pathname.includes("/payment")) {
    try {
      const token = request.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = await requireAuthenticatedUser(token);
      if (!hasPermission(user.role, "payments.pos")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      const result = await recordClinicPayment({
        billing_id,
        amount: body.amount,
        method: body.method,
        reference: body.reference,
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ ok: true, payment: result.payment });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing/payment]", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Handle /receipt endpoint
  if (pathname.includes("/receipt")) {
    try {
      const token = request.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = await requireAuthenticatedUser(token);
      if (!hasPermission(user.role, "payments.pos")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const result = await generateReceipt(billing_id);

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ ok: true, receipt: result.receipt });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing/receipt]", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
