"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaCircleCheck,
  FaCircleXmark,
  FaCloudArrowUp,
  FaImage,
  FaPlus,
  FaQuoteLeft,
  FaTrash,
  FaUserDoctor,
  FaWandMagicSparkles,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import type {
  LandingContent,
  LandingHowToStep,
  LandingNavItem,
  LandingService,
  LandingServiceBullet,
  LandingTestimonial,
} from "@/src/lib/db/types";

type Tab =
  | "hero"
  | "navigation"
  | "doctor"
  | "services"
  | "howTo"
  | "testimonials"
  | "cta"
  | "booking"
  | "contact"
  | "footer";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "hero", label: "Hero" },
  { id: "navigation", label: "Navigation" },
  { id: "doctor", label: "Doctor" },
  { id: "services", label: "Services" },
  { id: "howTo", label: "How to Book" },
  { id: "testimonials", label: "Testimonials" },
  { id: "cta", label: "Closing CTA" },
  { id: "booking", label: "Booking" },
  { id: "contact", label: "Contact" },
  { id: "footer", label: "Footer" },
];

type Feedback = { kind: "ok" | "err"; msg: string } | null;

// Default fallbacks (mirror /public/images/*) — used when the DB row hasn't
// had an image uploaded yet. Keep these in sync with the bundled assets so
// the landing page never renders a broken <Image>.
const DEFAULT_HERO = "/images/chiarabg.png";
const DEFAULT_DOCTOR = "/images/doctora.png";

export default function ContentsManagerPage() {
  const { accessToken, role, isLoading } = useRole();
  const [content, setContent] = useState<LandingContent | null>(null);
  const [original, setOriginal] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [activeTab, setActiveTab] = useState<Tab>("hero");

  const canEdit = role === "SUPER_ADMIN" || role === "DOCTOR";

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/v2/landing-content", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as { content: LandingContent };
        if (!active) return;
        setContent(payload.content);
        setOriginal(payload.content);
      } catch (e) {
        if (active) setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Failed to load content" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!content || !original) return false;
    return JSON.stringify(content) !== JSON.stringify(original);
  }, [content, original]);

  function update<K extends keyof LandingContent>(key: K, value: LandingContent[K]) {
    setContent((c) => (c ? { ...c, [key]: value } : c));
    setFeedback(null);
  }

  function updateTestimonial(idx: number, patch: Partial<LandingTestimonial>) {
    setContent((c) => {
      if (!c) return c;
      const next = c.testimonials.slice();
      next[idx] = { ...next[idx], ...patch };
      return { ...c, testimonials: next };
    });
    setFeedback(null);
  }

  function addTestimonial() {
    setContent((c) =>
      c ? { ...c, testimonials: [...c.testimonials, { name: "", title: "", quote: "" }] } : c,
    );
  }

  function removeTestimonial(idx: number) {
    setContent((c) =>
      c ? { ...c, testimonials: c.testimonials.filter((_, i) => i !== idx) } : c,
    );
  }

  // Generic JSONB-array helpers — used by nav, services, how-to, footer.
  function patchArray<K extends keyof LandingContent>(
    key: K,
    fn: (current: LandingContent[K]) => LandingContent[K],
  ) {
    setContent((c) => (c ? { ...c, [key]: fn(c[key]) } : c));
    setFeedback(null);
  }

  function addNavItem() {
    patchArray("nav_items", (cur) => [...(cur as LandingNavItem[]), { label: "", href: "#" }]);
  }
  function removeNavItem(idx: number) {
    patchArray("nav_items", (cur) => (cur as LandingNavItem[]).filter((_, i) => i !== idx));
  }
  function updateNavItem(idx: number, p: Partial<LandingNavItem>) {
    patchArray("nav_items", (cur) => {
      const next = (cur as LandingNavItem[]).slice();
      next[idx] = { ...next[idx], ...p };
      return next;
    });
  }

  function addService() {
    patchArray("services", (cur) => [
      ...(cur as LandingService[]),
      { kind: "clinic", title: "", description: "", bullets: [] },
    ]);
  }
  function removeService(idx: number) {
    patchArray("services", (cur) => (cur as LandingService[]).filter((_, i) => i !== idx));
  }
  function updateService(idx: number, p: Partial<LandingService>) {
    patchArray("services", (cur) => {
      const next = (cur as LandingService[]).slice();
      next[idx] = { ...next[idx], ...p };
      return next;
    });
  }
  function addBullet(serviceIdx: number) {
    patchArray("services", (cur) => {
      const next = (cur as LandingService[]).slice();
      next[serviceIdx] = {
        ...next[serviceIdx],
        bullets: [...next[serviceIdx].bullets, { title: "", body: "" }],
      };
      return next;
    });
  }
  function removeBullet(serviceIdx: number, bulletIdx: number) {
    patchArray("services", (cur) => {
      const next = (cur as LandingService[]).slice();
      next[serviceIdx] = {
        ...next[serviceIdx],
        bullets: next[serviceIdx].bullets.filter((_, i) => i !== bulletIdx),
      };
      return next;
    });
  }
  function updateBullet(
    serviceIdx: number,
    bulletIdx: number,
    p: Partial<LandingServiceBullet>,
  ) {
    patchArray("services", (cur) => {
      const next = (cur as LandingService[]).slice();
      const bullets = next[serviceIdx].bullets.slice();
      bullets[bulletIdx] = { ...bullets[bulletIdx], ...p };
      next[serviceIdx] = { ...next[serviceIdx], bullets };
      return next;
    });
  }

  function addStep() {
    patchArray("how_to_steps", (cur) => {
      const arr = cur as LandingHowToStep[];
      return [...arr, { step: arr.length + 1, title: "", description: "" }];
    });
  }
  function removeStep(idx: number) {
    patchArray("how_to_steps", (cur) =>
      (cur as LandingHowToStep[]).filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 })),
    );
  }
  function updateStep(idx: number, p: Partial<LandingHowToStep>) {
    patchArray("how_to_steps", (cur) => {
      const next = (cur as LandingHowToStep[]).slice();
      next[idx] = { ...next[idx], ...p };
      return next;
    });
  }

  function addFooterItem(key: "footer_services" | "footer_hours") {
    patchArray(key, (cur) => [...(cur as string[]), ""]);
  }
  function removeFooterItem(key: "footer_services" | "footer_hours", idx: number) {
    patchArray(key, (cur) => (cur as string[]).filter((_, i) => i !== idx));
  }
  function updateFooterItem(key: "footer_services" | "footer_hours", idx: number, value: string) {
    patchArray(key, (cur) => {
      const next = (cur as string[]).slice();
      next[idx] = value;
      return next;
    });
  }

  async function handleSave() {
    if (!content || !accessToken || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      // Send only writable columns. Sent as Partial<LandingContent>; the
      // server whitelists again before persisting.
      const body: Partial<LandingContent> = {
        hero_eyebrow: content.hero_eyebrow,
        hero_title_line1: content.hero_title_line1,
        hero_title_line2: content.hero_title_line2,
        hero_subtitle: content.hero_subtitle,
        hero_cta_primary: content.hero_cta_primary,
        hero_cta_secondary: content.hero_cta_secondary,
        hero_background_url: content.hero_background_url,
        about_eyebrow: content.about_eyebrow,
        about_title: content.about_title,
        about_subtitle: content.about_subtitle,
        doctor_name: content.doctor_name,
        doctor_title: content.doctor_title,
        doctor_photo_url: content.doctor_photo_url,
        feature_1_title: content.feature_1_title,
        feature_1_body: content.feature_1_body,
        feature_2_title: content.feature_2_title,
        feature_2_body: content.feature_2_body,
        feature_3_title: content.feature_3_title,
        feature_3_body: content.feature_3_body,
        cta_title: content.cta_title,
        cta_subtitle: content.cta_subtitle,
        cta_button_label: content.cta_button_label,
        testimonials: content.testimonials,
        nav_items: content.nav_items,
        services_eyebrow: content.services_eyebrow,
        services_title: content.services_title,
        services_subtitle: content.services_subtitle,
        services: content.services,
        how_to_eyebrow: content.how_to_eyebrow,
        how_to_title: content.how_to_title,
        how_to_steps: content.how_to_steps,
        testimonials_eyebrow: content.testimonials_eyebrow,
        testimonials_title: content.testimonials_title,
        testimonials_subtitle: content.testimonials_subtitle,
        booking_title: content.booking_title,
        booking_subtitle: content.booking_subtitle,
        contact_eyebrow: content.contact_eyebrow,
        contact_title: content.contact_title,
        contact_subtitle: content.contact_subtitle,
        contact_info_title: content.contact_info_title,
        contact_hours_label: content.contact_hours_label,
        footer_brand_blurb: content.footer_brand_blurb,
        footer_services: content.footer_services,
        footer_hours: content.footer_hours,
        footer_contact_text: content.footer_contact_text,
        footer_copyright: content.footer_copyright,
      };
      const res = await fetch("/api/v2/landing-content", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as { content?: LandingContent; message?: string };
      if (!res.ok || !payload.content) throw new Error(payload.message ?? "Failed to save");
      setContent(payload.content);
      setOriginal(payload.content);
      setFeedback({ kind: "ok", msg: "Landing page updated. Refresh the public site to see the changes." });
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setContent(original);
    setFeedback(null);
  }

  if (isLoading || loading) {
    return <div className="h-40 animate-pulse rounded-3xl border border-emerald-100 bg-white shadow-sm" />;
  }

  if (!canEdit) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        You don&apos;t have permission to manage landing-page content.
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Content row not found. Run the latest migration and reload.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header toolbar */}
      <div className="rounded-3xl border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] p-5 shadow-[0_18px_45px_rgba(16,185,129,0.08)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
              <FaWandMagicSparkles className="h-3 w-3" aria-hidden="true" /> Contents Manager
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
              Edit your landing page
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Update text, swap the hero background and doctor photo, and curate testimonials. Changes go live the
              moment you save.
            </p>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            Preview public landing →
          </a>
        </div>
      </div>

      {feedback ? (
        <div
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.kind === "ok"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.kind === "ok" ? (
            <FaCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          ) : (
            <FaCircleXmark className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          )}
          <span>{feedback.msg}</span>
        </div>
      ) : null}

      {/* Tab pill — wraps to a second row on narrow screens; keeps focus
          state semantic so keyboard nav works. */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-emerald-100 bg-white p-1.5">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              aria-pressed={active}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                active
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === "hero" ? (
        <Section title="Hero (above the fold)">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <Field label="Eyebrow text (optional)" value={content.hero_eyebrow} onChange={(v) => update("hero_eyebrow", v)} placeholder="e.g., Welcome to Chiara Clinic" />
              <Field label="Title — Line 1" value={content.hero_title_line1} onChange={(v) => update("hero_title_line1", v)} />
              <Field label="Title — Line 2 (highlighted)" value={content.hero_title_line2} onChange={(v) => update("hero_title_line2", v)} />
              <Textarea label="Subtitle" rows={3} value={content.hero_subtitle} onChange={(v) => update("hero_subtitle", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary CTA label" value={content.hero_cta_primary} onChange={(v) => update("hero_cta_primary", v)} />
                <Field label="Secondary CTA label" value={content.hero_cta_secondary} onChange={(v) => update("hero_cta_secondary", v)} />
              </div>
            </div>
            <ImageUploader
              kind="hero-bg"
              label="Background image"
              hint="Wide landscape recommended (e.g., 1920×1080). Falls back to bundled default if cleared."
              currentUrl={content.hero_background_url}
              defaultUrl={DEFAULT_HERO}
              accessToken={accessToken}
              onChange={(url) => update("hero_background_url", url)}
              onError={(msg) => setFeedback({ kind: "err", msg })}
            />
          </div>
        </Section>
      ) : null}

      {activeTab === "doctor" ? (
        <Section title="Doctor / About section">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-3">
              <Field label="Eyebrow" value={content.about_eyebrow} onChange={(v) => update("about_eyebrow", v)} />
              <Field label="Section title" value={content.about_title} onChange={(v) => update("about_title", v)} />
              <Textarea label="Section subtitle" rows={2} value={content.about_subtitle} onChange={(v) => update("about_subtitle", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Doctor name" value={content.doctor_name} onChange={(v) => update("doctor_name", v)} />
                <Field label="Doctor title" value={content.doctor_title} onChange={(v) => update("doctor_title", v)} />
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Three Highlights</p>
                <FeatureRow
                  index={1}
                  title={content.feature_1_title}
                  body={content.feature_1_body}
                  onTitle={(v) => update("feature_1_title", v)}
                  onBody={(v) => update("feature_1_body", v)}
                />
                <FeatureRow
                  index={2}
                  title={content.feature_2_title}
                  body={content.feature_2_body}
                  onTitle={(v) => update("feature_2_title", v)}
                  onBody={(v) => update("feature_2_body", v)}
                />
                <FeatureRow
                  index={3}
                  title={content.feature_3_title}
                  body={content.feature_3_body}
                  onTitle={(v) => update("feature_3_title", v)}
                  onBody={(v) => update("feature_3_body", v)}
                />
              </div>
            </div>
            <ImageUploader
              kind="doctor-photo"
              label="Doctor photo"
              hint="Portrait orientation works best. PNG with transparency renders cleanest on the gradient card."
              currentUrl={content.doctor_photo_url}
              defaultUrl={DEFAULT_DOCTOR}
              accessToken={accessToken}
              onChange={(url) => update("doctor_photo_url", url)}
              onError={(msg) => setFeedback({ kind: "err", msg })}
              aspect="portrait"
            />
          </div>
        </Section>
      ) : null}

      {activeTab === "cta" ? (
        <Section title="Closing call-to-action banner">
          <div className="grid gap-3">
            <Field label="Title" value={content.cta_title} onChange={(v) => update("cta_title", v)} />
            <Textarea label="Subtitle" rows={2} value={content.cta_subtitle} onChange={(v) => update("cta_subtitle", v)} />
            <Field label="Button label" value={content.cta_button_label} onChange={(v) => update("cta_button_label", v)} />
          </div>
        </Section>
      ) : null}

      {activeTab === "navigation" ? (
        <Section
          title="Top-bar navigation"
          action={
            <button
              type="button"
              onClick={addNavItem}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <FaPlus className="h-3 w-3" aria-hidden="true" /> Add link
            </button>
          }
        >
          <p className="mb-3 text-xs text-slate-500">
            Each entry shows up in the public top bar. Use <code className="rounded bg-slate-100 px-1">#section-id</code> for in-page anchors (e.g., <code className="rounded bg-slate-100 px-1">#services</code>) or a path like <code className="rounded bg-slate-100 px-1">/login</code>.
          </p>
          {content.nav_items.length === 0 ? (
            <EmptyHint label="No nav links yet." />
          ) : (
            <div className="space-y-2">
              {content.nav_items.map((n, idx) => (
                <div key={idx} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Field label="Label" value={n.label} onChange={(v) => updateNavItem(idx, { label: v })} placeholder="Home" />
                      <Field label="Href" value={n.href} onChange={(v) => updateNavItem(idx, { href: v })} placeholder="#home" />
                    </div>
                    <RemoveButton onClick={() => removeNavItem(idx)} title="Remove link" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {activeTab === "services" ? (
        <Section title="Services & Pricing">
          <div className="grid gap-3 mb-5">
            <Field label="Eyebrow" value={content.services_eyebrow} onChange={(v) => update("services_eyebrow", v)} />
            <Field label="Section title" value={content.services_title} onChange={(v) => update("services_title", v)} />
            <Textarea label="Section subtitle" rows={2} value={content.services_subtitle} onChange={(v) => update("services_subtitle", v)} />
          </div>

          <div className="flex items-center justify-between mb-3 border-t border-emerald-100 pt-4">
            <h3 className="text-sm font-bold text-slate-900">Service cards</h3>
            <button
              type="button"
              onClick={addService}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <FaPlus className="h-3 w-3" aria-hidden="true" /> Add service
            </button>
          </div>
          {content.services.length === 0 ? (
            <EmptyHint label="No service cards yet." />
          ) : (
            <div className="space-y-3">
              {content.services.map((s, idx) => (
                <div key={idx} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
                      <KindSelect value={s.kind} onChange={(v) => updateService(idx, { kind: v })} />
                      <Field label="Title" value={s.title} onChange={(v) => updateService(idx, { title: v })} />
                    </div>
                    <RemoveButton onClick={() => removeService(idx)} title="Remove service" />
                  </div>
                  <Textarea label="Short description" rows={2} value={s.description} onChange={(v) => updateService(idx, { description: v })} />
                  <div className="rounded-lg border border-emerald-100 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Bullet points</p>
                      <button
                        type="button"
                        onClick={() => addBullet(idx)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
                      >
                        <FaPlus className="h-2.5 w-2.5" aria-hidden="true" /> Add bullet
                      </button>
                    </div>
                    {s.bullets.length === 0 ? (
                      <p className="text-xs text-slate-500">No bullets yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {s.bullets.map((b, bi) => (
                          <div key={bi} className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2">
                            <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Field label="Title" value={b.title} onChange={(v) => updateBullet(idx, bi, { title: v })} />
                              <Field label="Body" value={b.body} onChange={(v) => updateBullet(idx, bi, { body: v })} />
                            </div>
                            <RemoveButton onClick={() => removeBullet(idx, bi)} title="Remove bullet" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <strong>Note:</strong> hourly rates shown on each card come from the <a href="/pricing" className="underline">Pricing</a> module — they update automatically when you change consultation fees there.
          </p>
        </Section>
      ) : null}

      {activeTab === "howTo" ? (
        <Section
          title="How to Book section"
          action={
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <FaPlus className="h-3 w-3" aria-hidden="true" /> Add step
            </button>
          }
        >
          <div className="grid gap-3 mb-4">
            <Field label="Eyebrow" value={content.how_to_eyebrow} onChange={(v) => update("how_to_eyebrow", v)} />
            <Field label="Section title" value={content.how_to_title} onChange={(v) => update("how_to_title", v)} />
          </div>
          {content.how_to_steps.length === 0 ? (
            <EmptyHint label="No steps yet." />
          ) : (
            <div className="space-y-2">
              {content.how_to_steps.map((s, idx) => (
                <div key={idx} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-7 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <Field label="Step title" value={s.title} onChange={(v) => updateStep(idx, { title: v })} />
                      <Textarea label="Description" rows={2} value={s.description} onChange={(v) => updateStep(idx, { description: v })} />
                    </div>
                    <RemoveButton onClick={() => removeStep(idx)} title="Remove step" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {activeTab === "testimonials" ? (
        <Section
          title="Testimonials"
          action={
            <button
              type="button"
              onClick={addTestimonial}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <FaPlus className="h-3 w-3" aria-hidden="true" /> Add testimonial
            </button>
          }
        >
          <div className="grid gap-3 mb-5">
            <Field label="Eyebrow" value={content.testimonials_eyebrow} onChange={(v) => update("testimonials_eyebrow", v)} />
            <Field label="Section title" value={content.testimonials_title} onChange={(v) => update("testimonials_title", v)} />
            <Textarea label="Section subtitle" rows={2} value={content.testimonials_subtitle} onChange={(v) => update("testimonials_subtitle", v)} />
          </div>

          <div className="border-t border-emerald-100 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Patient quotes</p>
            {content.testimonials.length === 0 ? (
              <EmptyHint label="No testimonials yet." />
            ) : (
              <div className="space-y-3">
                {content.testimonials.map((t, idx) => (
                  <div key={idx} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                    <div className="flex items-start gap-2">
                      <FaQuoteLeft className="mt-1 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                      <div className="flex-1 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                          <Field
                            label="Name"
                            value={t.name}
                            onChange={(v) => updateTestimonial(idx, { name: v })}
                            placeholder="e.g., Maria S."
                          />
                          <Field
                            label="Role / context"
                            value={t.title}
                            onChange={(v) => updateTestimonial(idx, { title: v })}
                            placeholder="e.g., Clinic Patient"
                          />
                        </div>
                        <Textarea
                          label="Quote"
                          rows={2}
                          value={t.quote}
                          onChange={(v) => updateTestimonial(idx, { quote: v })}
                          placeholder="Their kind words…"
                        />
                      </div>
                      <RemoveButton onClick={() => removeTestimonial(idx)} title="Remove testimonial" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      ) : null}

      {activeTab === "booking" ? (
        <Section title="Booking section header">
          <p className="mb-3 text-xs text-slate-500">
            These are the title and subtitle that appear above the embedded booking widget on the public landing page.
          </p>
          <div className="grid gap-3">
            <Field label="Title" value={content.booking_title} onChange={(v) => update("booking_title", v)} />
            <Textarea label="Subtitle" rows={2} value={content.booking_subtitle} onChange={(v) => update("booking_subtitle", v)} />
          </div>
        </Section>
      ) : null}

      {activeTab === "contact" ? (
        <Section title="Contact section">
          <div className="grid gap-3">
            <Field label="Eyebrow" value={content.contact_eyebrow} onChange={(v) => update("contact_eyebrow", v)} />
            <Field label="Title" value={content.contact_title} onChange={(v) => update("contact_title", v)} />
            <Textarea label="Subtitle" rows={2} value={content.contact_subtitle} onChange={(v) => update("contact_subtitle", v)} />
            <Field label="Contact info card title" value={content.contact_info_title} onChange={(v) => update("contact_info_title", v)} />
            <Field label="Office hours line" value={content.contact_hours_label} onChange={(v) => update("contact_hours_label", v)} />
          </div>
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <strong>Note:</strong> phone and email come from <a href="/settings" className="underline">Settings → Clinic info</a> so they stay consistent across the site.
          </p>
        </Section>
      ) : null}

      {activeTab === "footer" ? (
        <Section title="Footer">
          <div className="space-y-5">
            <Textarea label="Brand blurb" rows={2} value={content.footer_brand_blurb} onChange={(v) => update("footer_brand_blurb", v)} />

            <FooterStringList
              label="Services list"
              items={content.footer_services}
              onAdd={() => addFooterItem("footer_services")}
              onRemove={(i) => removeFooterItem("footer_services", i)}
              onChange={(i, v) => updateFooterItem("footer_services", i, v)}
              placeholder="e.g., Clinic Visits"
            />
            <FooterStringList
              label="Office hours list"
              items={content.footer_hours}
              onAdd={() => addFooterItem("footer_hours")}
              onRemove={(i) => removeFooterItem("footer_hours", i)}
              onChange={(i, v) => updateFooterItem("footer_hours", i, v)}
              placeholder="e.g., Sat: By Appointment"
            />

            <Textarea label="Contact paragraph" rows={2} value={content.footer_contact_text} onChange={(v) => update("footer_contact_text", v)} />
            <Field label="Copyright line" value={content.footer_copyright} onChange={(v) => update("footer_copyright", v)} />
          </div>
        </Section>
      ) : null}

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-30 mt-2 flex flex-col items-stretch gap-3 rounded-2xl border border-emerald-100 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-xs font-semibold ${dirty ? "text-amber-700" : "text-slate-500"}`}>
          {dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={handleReset}
            disabled={!dirty || saving}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function FeatureRow({
  index,
  title,
  body,
  onTitle,
  onBody,
}: {
  index: number;
  title: string;
  body: string;
  onTitle: (v: string) => void;
  onBody: (v: string) => void;
}) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Highlight #{index}</p>
      <div className="space-y-2">
        <Field label="Title" value={title} onChange={onTitle} />
        <Textarea label="Body" rows={2} value={body} onChange={onBody} />
      </div>
    </div>
  );
}

function ImageUploader({
  kind,
  label,
  hint,
  currentUrl,
  defaultUrl,
  accessToken,
  onChange,
  onError,
  aspect = "landscape",
}: {
  kind: "hero-bg" | "doctor-photo";
  label: string;
  hint: string;
  currentUrl: string | null;
  defaultUrl: string;
  accessToken: string | null;
  onChange: (url: string | null) => void;
  onError: (msg: string) => void;
  aspect?: "landscape" | "portrait";
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = currentUrl ?? defaultUrl;
  const usingDefault = !currentUrl;

  async function handleFile(file: File) {
    if (!accessToken) {
      onError("Sign in again to upload images.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      const res = await fetch("/api/v2/landing-content/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !payload.url) throw new Error(payload.message ?? "Upload failed");
      onChange(payload.url);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {kind === "doctor-photo" ? <FaUserDoctor className="h-3 w-3" aria-hidden="true" /> : <FaImage className="h-3 w-3" aria-hidden="true" />}
            {label}
          </p>
          <p className="mt-1 text-xs text-slate-600">{hint}</p>
        </div>
        {usingDefault ? (
          <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
            Default
          </span>
        ) : null}
      </div>

      <div
        className={`mt-3 overflow-hidden rounded-lg border border-emerald-100 bg-white ${
          aspect === "portrait" ? "aspect-[3/4]" : "aspect-[16/9]"
        } relative`}
      >
        <Image src={previewUrl} alt={label} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FaCloudArrowUp className="h-3 w-3" aria-hidden="true" />
          {uploading ? "Uploading…" : currentUrl ? "Replace image" : "Upload image"}
        </button>
        {currentUrl ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Use default
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>
    </div>
  );
}

// Compact empty-state hint reused by every "list" tab when the array is
// empty. Keeps the visual language consistent.
function EmptyHint({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

// Trash-icon button — used to remove an item from any list editor.
function RemoveButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-red-200 bg-white p-2 text-red-600 transition hover:border-red-300 hover:bg-red-50"
      title={title}
    >
      <FaTrash className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

// `kind` drives icon + color on the public site. We expose the two known
// values plus a free-text "Other" so future services don't need a code
// change. Defaults to clinic.
function KindSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Kind</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="clinic">Clinic visit (emerald)</option>
        <option value="online">Online consultation (sky)</option>
        <option value="other">Other (neutral)</option>
      </select>
    </label>
  );
}

// Simple add/edit/remove editor for a flat list of strings. Used by the
// footer's Services and Hours columns.
function FooterStringList({
  label,
  items,
  onAdd,
  onRemove,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onChange: (idx: number, value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
        >
          <FaPlus className="h-2.5 w-2.5" aria-hidden="true" /> Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No items yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={v}
                onChange={(e) => onChange(i, e.target.value)}
                placeholder={placeholder}
                className="flex-1 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <RemoveButton onClick={() => onRemove(i)} title="Remove" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
