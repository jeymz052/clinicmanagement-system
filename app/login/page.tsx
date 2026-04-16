"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";

type AuthMode = "signin" | "signup";

type AuthForm = {
  fullName: string;
  email: string;
  password: string;
};

const INITIAL_FORM: AuthForm = {
  fullName: "",
  email: "",
  password: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SIGNIN_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [formData, setFormData] = useState<AuthForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [signInAttempts, setSignInAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("message");
    if (!message) return;
    const timer = window.setTimeout(() => {
      setFeedback(message);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function submitReset(event: React.FormEvent) {
    event.preventDefault();
    setResetFeedback(null);
    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const email = resetEmail.trim().toLowerCase();
        if (!email || !EMAIL_RE.test(email)) {
          setResetFeedback("Enter a valid email address.");
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) {
          setResetFeedback(error.message);
          return;
        }
        setResetFeedback(
          "If an account exists for that email, a password reset link has been sent.",
        );
      } catch (e) {
        setResetFeedback(
          e instanceof Error ? e.message : "Failed to send reset email.",
        );
      }
    });
  }

  function updateField<K extends keyof AuthForm>(field: K, value: AuthForm[K]) {
    setFormData((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = formData.email.trim().toLowerCase();
    const now = Date.now();

    if (!EMAIL_RE.test(normalizedEmail)) {
      setFeedback("Please enter a valid email address.");
      return;
    }

    if (mode === "signup" && formData.fullName.trim().length < 2) {
      setFeedback("Full name must be at least 2 characters.");
      return;
    }

    if (formData.password.length < 8) {
      setFeedback("Password must be at least 8 characters.");
      return;
    }

    if (mode === "signin" && lockUntil && lockUntil > now) {
      const minsLeft = Math.max(1, Math.ceil((lockUntil - now) / 60000));
      setFeedback(`Too many attempts. Try again in ${minsLeft} minute(s).`);
      return;
    }

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: formData.password,
        });

        if (error) {
          const nextAttempts = signInAttempts + 1;
          setSignInAttempts(nextAttempts);
          const attemptsLeft = Math.max(0, MAX_SIGNIN_ATTEMPTS - nextAttempts);
          if (nextAttempts >= MAX_SIGNIN_ATTEMPTS) {
            const locked = Date.now() + LOCK_MINUTES * 60_000;
            setLockUntil(locked);
            setFeedback(
              `Too many failed logins. Account login is temporarily locked for ${LOCK_MINUTES} minutes.`,
            );
            return;
          }
          setFeedback(
            `Invalid credentials. ${attemptsLeft} attempt(s) remaining before temporary lock.`,
          );
          return;
        }

        setSignInAttempts(0);
        setLockUntil(null);
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            full_name: formData.fullName,
          },
        },
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      setFeedback(
        "Account created. Check your email and confirm your account before signing in.",
      );
      setMode("signin");
      setFormData((current) => ({
        ...current,
        password: "",
      }));
    });
  }

  return (
    <main className="relative min-h-screen flex items-center justify-end bg-slate-950 overflow-hidden pr-8 md:pr-20 lg:pr-32">
      {/* Full-screen background image */}
      <Image
        src="/images/chiarabg.png"
        alt="Clinic consultation background"
        fill
        priority
        quality={100}
        className="object-cover object-left md:object-center"
        sizes="100vw"
      />
      {/* Subtle overlay to keep text readable */}
      <div className="absolute inset-0 bg-black/15" />

      {/* Login card - glassmorphism matching reference */}
      <section className="relative z-10 w-full max-w-xs rounded-2xl border-2 border-teal-700/50 bg-transparent backdrop-blur-[2px] shadow-xl p-5 overflow-hidden">

        {/* Content */}
        <div className="relative z-10">
        {/* Logo — negative margin trims transparent padding baked into the PNG */}
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

        {/* Heading */}
        <div className="text-center mb-3" style={{ fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
          <p className="text-xl font-extrabold text-white drop-shadow">
            {mode === "signin" ? "Welcome Back!" : "Create Account"}
          </p>
          <p className="text-xs text-white/95 mt-0.5">
            {mode === "signin" ? "Sign in to continue your journey" : "Fill in your details to get started"}
          </p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <Field label="Full Name">
              <input
                type="text"
                value={formData.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/60 outline-none transition focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                placeholder="Juan Dela Cruz"
                required
              />
            </Field>
          ) : null}

          <Field label="Email">
            <input
              type="email"
              value={formData.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/60 outline-none transition focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
              placeholder="name@clinicmail.com"
              required
            />
          </Field>

          <Field label="Password">
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(event) => updateField("password", event.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 pr-11 text-white placeholder:text-white/60 outline-none transition focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-white/80 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M3.53 2.47a.75.75 0 10-1.06 1.06l2.31 2.31C2.8 7.33 1.55 9.24 1.09 10.04a1.97 1.97 0 000 1.92C2 13.57 5.3 18.5 12 18.5c2.36 0 4.38-.61 6.08-1.57l2.39 2.39a.75.75 0 101.06-1.06L3.53 2.47zM12 6.5c4.84 0 7.47 3.57 8.6 5.5a.47.47 0 010 .5c-.41.7-1.08 1.73-2.05 2.69l-2.28-2.28a4.5 4.5 0 00-6.18-6.18L7.9 4.54A11.33 11.33 0 0112 6.5zm2.75 6.72l-3.97-3.97a3 3 0 003.97 3.97zm-5.57-2.39l3.18 3.18a3 3 0 01-3.18-3.18z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M12 5.75c-6.7 0-10 4.93-10.91 6.54a1.97 1.97 0 000 1.92C2 15.83 5.3 20.75 12 20.75s10-4.92 10.91-6.54a1.97 1.97 0 000-1.92C22 10.68 18.7 5.75 12 5.75zm0 12.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13zm0-10.5a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                )}
              </button>
            </div>
          </Field>

          {mode === "signin" ? (
            <div className="-mt-1 flex items-center justify-end">
              <button
                type="button"
                className="text-xs font-semibold text-white/90 hover:underline"
                onClick={() => {
                  setShowReset(true);
                  setResetEmail(formData.email);
                  setResetFeedback(null);
                }}
              >
                Forgot password?
              </button>
            </div>
          ) : null}

          {feedback ? (
            <div className="rounded-xl border border-amber-300/60 bg-amber-500/20 px-4 py-3 text-sm text-amber-100">
              {feedback}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2.5 font-semibold text-white shadow-lg shadow-teal-900/40 transition hover:bg-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-teal-800 disabled:text-teal-300"
          >
            {mode === "signin" ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h13m0 0l-4-4m4 4l-4 4" />
                <rect x="16" y="6" width="5" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v6m3-3h-6" />
              </svg>
            )}
            {isPending
              ? mode === "signin"
                ? "Signing In..."
                : "Creating Account..."
              : mode === "signin"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <div className="mt-3 text-center">
          {mode === "signin" ? (
            <p className="text-sm text-white/95">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="text-white font-semibold hover:underline"
                onClick={() => { setMode('signup'); setFeedback(null); }}
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-sm text-white/95">
              Already have an account?{' '}
              <button
                type="button"
                className="text-white font-semibold hover:underline"
                onClick={() => { setMode('signin'); setFeedback(null); }}
              >
                Sign In
              </button>
            </p>
          )}
        </div>
        </div>
      </section>

      {showReset ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-950/80 p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold">Reset password</p>
                <p className="mt-1 text-xs text-white/75">
                  We&apos;ll send a reset link to your email.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => setShowReset(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={submitReset}>
              <Field label="Email">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/60 outline-none transition focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                  placeholder="name@clinicmail.com"
                  required
                />
              </Field>

              {resetFeedback ? (
                <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/90">
                  {resetFeedback}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-teal-600 px-3 py-2.5 font-semibold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-teal-800 disabled:text-teal-300"
              >
                {isPending ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
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
    <label className="block text-sm font-semibold text-white/95 mb-1 tracking-wide">
      {label}
      {children}
    </label>
  );
}
