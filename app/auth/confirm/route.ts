import { NextResponse } from "next/server";
import { createClient, type EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") ?? "/login";
  const redirectUrl = new URL(next, requestUrl.origin);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || !tokenHash || !type) {
    redirectUrl.searchParams.set(
      "message",
      "Email confirmation link is invalid or expired.",
    );
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    redirectUrl.searchParams.set(
      "message",
      "Email confirmation link is invalid or expired.",
    );
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set(
    "message",
    "Email verified. You can now sign in.",
  );
  return NextResponse.redirect(redirectUrl);
}
