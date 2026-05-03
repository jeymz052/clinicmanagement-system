import { NextResponse } from "next/server";
import { HttpError } from "@/src/lib/http";
import { assertTrustedOrigin, enforceRateLimit } from "@/src/lib/security";
import { sendContactEmail } from "@/src/lib/services/emailjs";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);
    enforceRateLimit(req, "contact", 5, 60_000);

    const body = await req.json();
    const { name, email, message } = body || {};

    if (!name || !email || !message) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof message !== "string" ||
      !isValidEmail(email)
    ) {
      return NextResponse.json({ message: "Please provide a valid name, email, and message." }, { status: 400 });
    }

    await sendContactEmail({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
