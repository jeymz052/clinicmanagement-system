"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";
import { ROLE_PROFILES, type UserRole } from "@/src/lib/roles";

type AuthMode = "signin" | "signup";

type AuthForm = {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
};

const INITIAL_FORM: AuthForm = {
  fullName: "",
  email: "",
  password: "",
  role: "PATIENT",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [formData, setFormData] = useState<AuthForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof AuthForm>(field: K, value: AuthForm[K]) {
    setFormData((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          setFeedback(error.message);
          return;
        }

        router.replace("/dashboard");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: formData.role,
            full_name: formData.fullName,
          },
        },
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      setFeedback(
        "Account created. If email confirmation is enabled in Supabase, confirm your email before signing in.",
      );
      setMode("signin");
      setFormData((current) => ({
        ...current,
        password: "",
      }));
    });
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden">
      <Image
        src="/images/clincicsystembg.jpg"
        alt="Clinic consultation background"
        fill
        priority
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-teal-950/65 to-cyan-100/30" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.24),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.15),transparent_28%)]" />

      <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/60 bg-white/5 p-10 shadow-lg shadow-black/20">
        <div className="flex flex-col items-center text-center mb-6" style={{ fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
          <p className="text-3xl font-extrabold text-slate-900 drop-shadow mb-1">
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </p>
          <h2 className="text-lg font-bold text-teal-500 tracking-widest uppercase">
            CHIARA CLINIC MANAGEMENT SYSTEM
          </h2>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <Field label="Full Name">
              <input
                type="text"
                value={formData.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white/95 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none ring-teal-400 transition focus:ring shadow-sm"
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
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white/95 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none ring-teal-400 transition focus:ring shadow-sm"
              placeholder="name@clinicmail.com"
              required
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={formData.password}
              onChange={(event) => updateField("password", event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white/95 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none ring-teal-400 transition focus:ring shadow-sm"
              placeholder="••••••••"
              required
            />
          </Field>

          {mode === "signup" ? (
            <Field label="Role">
              <select
                value={formData.role}
                onChange={(event) => updateField("role", event.target.value as UserRole)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white/95 px-4 py-3 text-slate-900 outline-none ring-teal-400 transition focus:ring shadow-sm"
              >
                {ROLE_PROFILES.map((profile) => (
                  <option key={profile.role} value={profile.role}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {feedback ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {feedback}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white shadow-lg shadow-teal-900/10 transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300"
          >
            {mode === "signin" ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h13m0 0l-4-4m4 4l-4 4" />
                <rect x="16" y="6" width="5" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
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

        <div className="mt-8 text-center">
          {mode === "signin" ? (
            <p className="text-base text-slate-100/90">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="text-teal-300 font-bold hover:underline inline-flex items-center gap-1"
                onClick={() => { setMode('signup'); setFeedback(null); }}
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-base text-slate-100/90">
              Already have an account?{' '}
              <button
                type="button"
                className="text-teal-300 font-bold hover:underline inline-flex items-center gap-1"
                onClick={() => { setMode('signin'); setFeedback(null); }}
              >
                Sign In
              </button>
            </p>
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
    <label className="block text-base font-bold text-slate-900 mb-1 tracking-wide drop-shadow-sm">
      {label}
      {children}
    </label>
  );
}
