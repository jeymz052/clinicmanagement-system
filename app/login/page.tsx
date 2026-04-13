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
    <main className="relative min-h-screen flex items-center justify-end bg-slate-950 overflow-hidden pr-8 md:pr-20 lg:pr-32">
      {/* Full-screen background image */}
      <Image
        src="/images/chiarabg.png"
        alt="Clinic consultation background"
        fill
        priority
        quality={100}
        className="object-cover object-center"
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
          <p className="text-xs text-white/80 mt-0.5">
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
            <input
              type="password"
              value={formData.password}
              onChange={(event) => updateField("password", event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/60 outline-none transition focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
              placeholder="••••••••"
              required
            />
          </Field>

          {mode === "signup" ? (
            <Field label="Role">
              <select
                value={formData.role}
                onChange={(event) => updateField("role", event.target.value as UserRole)}
                className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-white outline-none transition focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
              >
                {ROLE_PROFILES.map((profile) => (
                  <option key={profile.role} value={profile.role} className="bg-slate-800 text-white">
                    {profile.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

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
            <p className="text-sm text-white">
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
            <p className="text-sm text-white">
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
