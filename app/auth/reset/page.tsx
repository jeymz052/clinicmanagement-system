"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";

type Step = "verifying" | "set-password" | "done" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("verifying");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash,
        );

        // 1) Newer PKCE links: ?code=...
        const code = queryParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!active) return;
          if (error) {
            setStep("error");
            setFeedback("Reset link is invalid or expired.");
            return;
          }
        } else {
          // 2) Hash-token links: #access_token=...&refresh_token=...
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!active) return;
            if (error) {
              setStep("error");
              setFeedback("Reset link is invalid or expired.");
              return;
            }
          } else {
            // 3) token_hash links: ?token_hash=...&type=recovery
            const tokenHash = queryParams.get("token_hash");
            const type = queryParams.get("type");
            if (tokenHash && type === "recovery") {
              const { error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: "recovery",
              });
              if (!active) return;
              if (error) {
                setStep("error");
                setFeedback("Reset link is invalid or expired.");
                return;
              }
            }
          }
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (!active) return;
        if (!sessionData.session) {
          setStep("error");
          setFeedback("Reset link is invalid or expired.");
          return;
        }

        setStep("set-password");
      } catch (e) {
        if (!active) return;
        setStep("error");
        setFeedback(e instanceof Error ? e.message : "Failed to verify reset link.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    if (password.length < 8) {
      setFeedback("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFeedback("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFeedback(error.message);
        return;
      }

      setStep("done");
      setFeedback("Password updated. Redirecting to login...");
      setTimeout(() => {
        router.replace("/login?message=" + encodeURIComponent("Password updated. Please sign in."));
      }, 900);
    });
  }

  return (
    <main className="relative min-h-screen flex items-center justify-end bg-slate-950 overflow-hidden pr-8 md:pr-20 lg:pr-32">
      <Image
        src="/images/chiarabg.png"
        alt="Clinic consultation background"
        fill
        priority
        quality={100}
        className="object-cover object-left md:object-center"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/15" />

      <section className="relative z-10 w-full max-w-xs rounded-2xl border-2 border-teal-700/50 bg-transparent backdrop-blur-[2px] shadow-xl p-5 overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-center -mb-4 overflow-hidden">
            <Image
              src="/images/chiaralogo.png"
              alt="Chiara Logo"
              width={280}
              height={100}
              priority
              quality={100}
              className="object-contain drop-shadow-lg -mt-6 -mb-6"
            />
          </div>

          <div className="text-center mb-3" style={{ fontFamily: "Inter, Segoe UI, Arial, sans-serif" }}>
            <p className="text-xl font-extrabold text-white drop-shadow">Reset Password</p>
            <p className="text-xs text-white/80 mt-0.5">
              {step === "verifying"
                ? "Verifying reset link..."
                : step === "set-password"
                  ? "Set a new password for your account."
                  : step === "done"
                    ? "Password updated."
                    : "Unable to reset password."}
            </p>
          </div>

          {step === "set-password" ? (
            <form className="space-y-3" onSubmit={submit}>
              <Field label="New password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/60 outline-none transition focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                  placeholder="••••••••"
                  required
                />
              </Field>
              <Field label="Confirm password">
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/60 outline-none transition focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                  placeholder="••••••••"
                  required
                />
              </Field>

              {feedback ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-200">
                  {feedback}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2.5 font-semibold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-teal-800 disabled:text-teal-300"
              >
                {isPending ? "Updating..." : "Update password"}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {feedback ? (
                <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/90">
                  {feedback}
                </div>
              ) : null}

              {step === "error" ? (
                <button
                  type="button"
                  onClick={() => router.replace("/login")}
                  className="w-full rounded-lg bg-teal-600 px-3 py-2.5 font-semibold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-500"
                >
                  Back to login
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-white mb-1 tracking-wide">
      {label}
      {children}
    </label>
  );
}

