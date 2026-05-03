"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaClinicMedical, FaVideo, FaHome, FaEnvelope, FaPhone, FaBars, FaTimes } from "react-icons/fa";
import { FaHeartPulse, FaQuoteLeft, FaStar, FaUserDoctor } from "react-icons/fa6";
import BookAppointmentPage from "@/src/components/appointments/BookAppointmentPage";
import ScrollReveal from "@/src/components/marketing/ScrollReveal";

export default function LandingPage() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(null);
    setContactLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to send");
      setContactSuccess("Message sent — we'll reply shortly.");
      setContactForm({ name: "", email: "", message: "" });
    } catch (err: unknown) {
      setContactError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setContactLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push("/register");
  };

  const handleBookNow = () => {
    // smooth scroll to booking section on landing
    const el = document.getElementById("booking");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else router.push("/#booking");
  };

  const handleContactClick = () => {
    const el = document.getElementById("contact");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else router.push("/#contact");
  };

  const testimonials = [
    {
      name: "Maria S.",
      title: "Clinic Patient",
      quote: "Dr. Chiara explains everything clearly and makes every visit feel calm, personal, and reassuring.",
    },
    {
      name: "James R.",
      title: "Online Consultation Patient",
      quote: "Booking was easy, the online consultation was smooth, and I still felt genuinely cared for from start to finish.",
    },
    {
      name: "Angela T.",
      title: "Returning Patient",
      quote: "The clinic feels organized and professional. I appreciate the friendly support and flexible appointment options.",
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-white flex flex-col">
      {/* Navigation (responsive) */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/40 bg-emerald-50/72 shadow-lg backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-stretch gap-3 px-4 sm:h-20 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-3 h-full">
            <Image
              src="/images/chiaralogo.png"
              alt="Chiara Clinic Logo"
              width={380}
              height={160}
              className="h-12 w-auto max-w-[13rem] object-contain sm:h-14 sm:max-w-[15rem] md:h-[3.7rem] md:max-w-[17rem]"
              priority
            />
          </div>

          {/* Nav links - hidden on small screens */}
          <div className="hidden h-full items-center justify-center justify-self-center gap-3 md:flex md:translate-x-8">
            <a href="#home" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-emerald-700"><FaHome className="text-emerald-600" /> Home</a>
            <a href="#services" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-emerald-700"><FaHeartPulse className="text-emerald-600" /> Services</a>
            <a href="#about" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-emerald-700"><FaUserDoctor className="text-emerald-600" /> About</a>
            <a href="#testimonials" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-emerald-700"><FaQuoteLeft className="text-emerald-600" /> Testimonials</a>
          </div>

          {/* Actions */}
          <div className="flex h-full items-center gap-2 sm:gap-3">
            <button onClick={handleContactClick} className="hidden rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 md:inline-flex">
              Contact Us
            </button>
            <Link href="/login" className="hidden sm:inline text-sm font-semibold text-slate-600 hover:text-emerald-700 transition">Sign In</Link>
            <button onClick={handleSignUp} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-700 sm:px-4 sm:text-sm">Sign Up</button>
            <button
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((s: boolean) => !s)}
              className="ml-2 md:hidden inline-flex items-center justify-center p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
            >
              {mobileOpen ? <FaTimes className="w-5 h-5" /> : <FaBars className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <div className="fixed left-0 right-0 top-16 z-40 border-b border-slate-200 bg-white shadow-md md:hidden">
          <div className="px-4 py-4 space-y-2">
            <a href="#home" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-emerald-50 flex items-center gap-2"><FaHome /> Home</a>
            <a href="#services" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-emerald-50 flex items-center gap-2"><FaHeartPulse /> Services</a>
            <a href="#about" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-emerald-50 flex items-center gap-2"><FaUserDoctor /> About</a>
            <a href="#testimonials" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-emerald-50 flex items-center gap-2"><FaQuoteLeft /> Testimonials</a>
            <div className="pt-3 flex items-center gap-3">
              <button onClick={() => { setMobileOpen(false); handleContactClick(); }} className="flex-1 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                Contact Us
              </button>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center rounded-full border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50">Sign In</Link>
              <button onClick={() => { setMobileOpen(false); handleSignUp(); }} className="flex-1 rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700">Sign Up</button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="home" className="order-1 relative flex min-h-screen items-center justify-center overflow-hidden px-0 pt-24 sm:pt-28 md:justify-end md:pt-36">
        {/* Full Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/chiarabg.png"
            alt="Clinic background"
            fill
            className="object-cover object-right"
            priority
            quality={100}
          />
          {/* Overlay for readability while preserving background */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
          {/* Left mask removed per user request */}
        </div>

        {/* Left Side Content */}
        <ScrollReveal
          className="relative z-10 mx-auto w-full max-w-2xl px-4 text-center sm:px-6 md:mx-0 md:mr-24 md:px-6 md:text-right"
          delayMs={100}
          direction="right"
        >
          <div>
            <h1 className="mb-5 text-4xl leading-none font-black text-slate-900 drop-shadow-lg sm:text-5xl sm:leading-tight md:mb-6 md:text-7xl">
              Your Health,
              <br />
              <span className="text-emerald-600">Our Priority</span>
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-left text-base leading-relaxed text-slate-700 drop-shadow sm:text-lg md:mb-10 md:ml-auto md:mr-0 md:max-w-xl md:text-right md:text-xl">
              Expert healthcare from Dr. Chiara Punzalan. Book clinic visits or online consultations with flexibility and convenience.
            </p>
            <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 md:justify-end">
              <button
                onClick={handleBookNow}
                className="w-full max-w-sm rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
              >
                Book Appointment Now
              </button>
              <a
                href="#services"
                className="inline-block w-full max-w-sm rounded-full border-2 border-emerald-600 px-6 py-3.5 text-center text-base font-bold text-emerald-600 transition hover:bg-emerald-50 sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
              >
                Learn More
              </a>
            </div>
            
          </div>
        </ScrollReveal>

        {/* Right Side - Doctor Image removed per request */}
      </section>

      {/* Doctor Profile Section */}
      <ScrollReveal as="section" id="about" className="order-5 bg-gradient-to-b from-emerald-50/80 to-white py-16 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <ScrollReveal className="mb-12 text-center md:mb-16" delayMs={40} direction="none">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700 mb-2">
              Meet Your Doctor
            </p>
            <h2 className="mb-4 text-3xl font-black text-slate-900 sm:text-4xl md:text-5xl">
              Expert Healthcare Provider
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
              With years of experience in general medicine and patient care
            </p>
          </ScrollReveal>

          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
            <ScrollReveal className="order-2 flex justify-center overflow-visible md:order-1" delayMs={80} direction="left">
              <div className="relative w-full max-w-md rounded-[2rem] border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/70 p-4 shadow-[0_24px_60px_rgba(16,185,129,0.12)] sm:p-6 md:max-w-lg">
                <div className="absolute -inset-3 rounded-[2.25rem] bg-gradient-to-br from-emerald-100 to-teal-100 opacity-50 blur-2xl" />
                <Image
                  src="/images/doctora.png"
                  alt="Dr. Chiara C. Punzalan"
                  width={640}
                  height={820}
                  className="relative z-10 mx-auto h-auto w-full object-contain object-center drop-shadow-2xl"
                  quality={100}
                />
              </div>
            </ScrollReveal>

            <ScrollReveal className="order-1 md:order-2" delayMs={140} direction="right">
              <h3 className="mb-4 text-2xl font-black text-slate-900 sm:text-3xl">
                Dra. Chiara C. Punzalan M.D.
              </h3>
              <p className="text-emerald-700 font-bold text-lg mb-6">General Medicine Specialist</p>
              <div className="space-y-4 mb-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-100">
                      <span className="text-emerald-700">✓</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Professional Expertise</h4>
                    <p className="text-slate-600">Comprehensive general medicine practice with focus on patient wellness</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-100">
                      <span className="text-emerald-700">✓</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Flexible Consultation</h4>
                    <p className="text-slate-600">Choose between clinic visits or online consultations for your convenience</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-100">
                      <span className="text-emerald-700">✓</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Patient-Centered Care</h4>
                    <p className="text-slate-600">Dedicated to understanding your health concerns and providing quality care</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-5 text-center">
                  <p className="text-3xl font-black text-emerald-700">8am</p>
                  <p className="text-sm text-slate-600 mt-1">Opens</p>
                </div>
                <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-5 text-center">
                  <p className="text-3xl font-black text-emerald-700">5pm</p>
                  <p className="text-sm text-slate-600 mt-1">Closes</p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </ScrollReveal>

      {/* Testimonials Section */}
      <ScrollReveal as="section" id="testimonials" className="order-6 bg-gradient-to-b from-white to-emerald-50/70 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <ScrollReveal className="mb-12 text-center" delayMs={30} direction="none">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">
              Patient Stories
            </p>
            <h2 className="text-3xl font-black text-slate-900 sm:text-4xl md:text-5xl">
              What Patients Say
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 sm:text-lg">
              Trusted care, thoughtful consultations, and a booking experience designed to feel simple and supportive.
            </p>
          </ScrollReveal>

          <div className="grid gap-6 lg:grid-cols-3">
            {testimonials.map((item, index) => (
              <ScrollReveal key={item.name} delayMs={index * 110} direction="up">
                <article className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_40px_rgba(16,185,129,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(16,185,129,0.14)]">
                <div className="mb-5 flex items-center justify-between">
                  <FaQuoteLeft className="text-2xl text-emerald-300" />
                  <div className="flex items-center gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FaStar key={star} />
                    ))}
                  </div>
                </div>
                <p className="text-base leading-7 text-slate-600">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="mt-6 border-t border-emerald-100 pt-4">
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-sm text-emerald-700">{item.title}</p>
                </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* Services & Pricing Section */}
      <ScrollReveal as="section" id="services" className="order-3 bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <ScrollReveal className="mb-12 text-center" delayMs={30} direction="none">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700 mb-2">
              Our Services
            </p>
            <h2 className="mb-4 text-3xl font-black text-slate-900 sm:text-4xl md:text-5xl">
              Services & Pricing
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
              Transparent pricing for both clinic and online consultations
            </p>
          </ScrollReveal>

          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            {/* Clinic Visit */}
            <ScrollReveal delayMs={70} direction="left">
            <div className="rounded-3xl border-2 border-emerald-100 overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-8">
                <div className="text-5xl mb-4 text-emerald-700"><FaClinicMedical /></div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Clinic Visit</h3>
                <p className="text-slate-600 mb-6">In-person consultation at our facility</p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Direct Examination</p>
                      <p className="text-sm text-slate-600">Thorough medical assessment</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Face-to-Face Interaction</p>
                      <p className="text-sm text-slate-600">Better for complex conditions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Prescription Services</p>
                      <p className="text-sm text-slate-600">Direct access to prescriptions</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-emerald-200 pt-6">
                  <p className="text-4xl font-black text-emerald-700">₱350</p>
                  <p className="text-sm text-slate-600 mt-1">per hour</p>
                </div>
              </div>
            </div>
            </ScrollReveal>

            {/* Online Consultation */}
            <ScrollReveal delayMs={170} direction="right">
            <div className="rounded-3xl border-2 border-sky-100 overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-8">
                <div className="text-5xl mb-4 text-sky-600"><FaVideo /></div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Online Consultation</h3>
                <p className="text-slate-600 mb-6">Remote consultation from the comfort of your home</p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <span className="text-sky-600 font-bold">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Video Call</p>
                      <p className="text-sm text-slate-600">Secure and private consultation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sky-600 font-bold">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Convenient Timing</p>
                      <p className="text-sm text-slate-600">Book from anywhere, anytime</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sky-600 font-bold">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Online Payment</p>
                      <p className="text-sm text-slate-600">Secure PayMongo integration</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-sky-200 pt-6">
                  <p className="text-4xl font-black text-sky-700">₱350</p>
                  <p className="text-sm text-slate-600 mt-1">per hour</p>
                </div>
              </div>
            </div>
            </ScrollReveal>
          </div>
        </div>
      </ScrollReveal>

      {/* How to Book Section */}
      <ScrollReveal as="section" className="order-2 bg-gradient-to-b from-emerald-50/50 to-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <ScrollReveal className="mb-12 text-center" delayMs={20} direction="none">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700 mb-2">
              Simple Process
            </p>
            <h2 className="text-3xl font-black text-slate-900 sm:text-4xl md:text-5xl">
              How to Book Your Appointment
            </h2>
          </ScrollReveal>

          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                step: 1,
                title: "Sign In",
                description: "Create an account or log in to your existing account",
              },
              {
                step: 2,
                title: "Choose Service",
                description: "Select clinic visit or online consultation",
              },
              {
                step: 3,
                title: "Pick Date & Time",
                description: "Choose your preferred appointment slot",
              },
              {
                step: 4,
                title: "Confirm & Pay",
                description: "Review details and complete secure payment",
              },
            ].map((item, index) => (
              <ScrollReveal key={item.step} delayMs={index * 90} direction="up">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-2xl mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-600">{item.description}</p>
              </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* CTA Section */}
      <ScrollReveal as="section" className="order-4 bg-gradient-to-r from-emerald-600 to-teal-600 py-16 md:py-24">
        <ScrollReveal className="mx-auto max-w-7xl px-4 text-center sm:px-6" delayMs={40} direction="none">
          <h2 className="mb-6 text-3xl font-black text-white sm:text-4xl md:text-5xl">
            Ready to Schedule Your Appointment?
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-emerald-50 sm:text-xl">
            Book now with Dr. Chiara Punzalan. Flexible scheduling for clinic and online consultations.
          </p>
          <button
            onClick={handleBookNow}
            className="rounded-full bg-white px-8 py-3.5 text-base font-bold text-emerald-600 transition hover:scale-105 hover:shadow-xl sm:px-10 sm:py-4 sm:text-lg"
          >
            Book Appointment Now
          </button>
        </ScrollReveal>
      </ScrollReveal>

      {/* Booking Section (embedded booking flow from dashboard) */}
      <ScrollReveal as="section" id="booking" className="order-7 bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl overflow-hidden px-4 sm:px-6">
          <ScrollReveal className="text-center mb-8" delayMs={30} direction="none">
            <h2 className="text-3xl font-black text-slate-900 md:text-4xl">Book an Appointment</h2>
            <p className="text-slate-600 mt-2">Use the booking widget below to pick service, date and time. You will be prompted to sign in or create an account before final confirmation.</p>
          </ScrollReveal>
          <ScrollReveal delayMs={100} direction="up">
            <BookAppointmentPage />
          </ScrollReveal>
        </div>
      </ScrollReveal>

      {/* Contact Section */}
      <ScrollReveal as="section" id="contact" className="order-8 bg-gradient-to-r from-emerald-600 to-teal-600 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <ScrollReveal className="text-center mb-12" delayMs={20} direction="none">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-100">Get in Touch</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">Contact Chiara Clinic</h2>
            <p className="mx-auto mt-3 max-w-2xl text-emerald-50">Have questions or need help booking? Send us a message or call us — we&rsquo;re here to help.</p>
          </ScrollReveal>

          <div className="grid items-start gap-8 md:grid-cols-2">
            <ScrollReveal className="space-y-6" delayMs={80} direction="left">
              <div className="rounded-2xl border border-white/35 bg-white/95 p-6 shadow-sm">
                <h3 className="mb-3 text-xl font-bold text-slate-900">Contact Info</h3>
                <div className="space-y-3 text-slate-700">
                  <div className="flex items-center gap-3">
                    <FaPhone className="w-5 h-5 text-emerald-700" />
                    <a href="tel:+15551234567" className="font-semibold text-slate-900">(555) 123-4567</a>
                  </div>
                  <div className="flex items-center gap-3">
                    <FaEnvelope className="w-5 h-5 text-emerald-700" />
                    <a href="mailto:info@chiaraclinic.com" className="font-semibold text-slate-900">info@chiaraclinic.com</a>
                  </div>
                  <div className="pt-2 text-sm text-slate-600">Office Hours: Mon - Fri, 8:00 AM - 5:00 PM</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/35 bg-white/90 p-6">
                <h4 className="mb-2 font-bold text-slate-900">Quick Links</h4>
                <ul className="space-y-2 text-slate-700">
                  <li><a href="#services" className="transition hover:text-emerald-700 hover:underline">Services</a></li>
                  <li><a href="#about" className="transition hover:text-emerald-700 hover:underline">About</a></li>
                  <li><a href="/login" className="transition hover:text-emerald-700 hover:underline">Sign In / Book</a></li>
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={160} direction="right">
              <form className="space-y-4 rounded-2xl border border-white/35 bg-white/95 p-5 shadow-sm sm:p-6" onSubmit={handleContactSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input aria-label="Name" required value={contactForm.name} onChange={(e)=>setContactForm((s) => ({ ...s, name: e.target.value }))} placeholder="Your name" className="w-full rounded-lg border px-4 py-3" />
                  <input aria-label="Email" required type="email" value={contactForm.email} onChange={(e)=>setContactForm((s) => ({ ...s, email: e.target.value }))} placeholder="Your email" className="w-full rounded-lg border px-4 py-3" />
                </div>
                <textarea aria-label="Message" required value={contactForm.message} onChange={(e)=>setContactForm((s) => ({ ...s, message: e.target.value }))} placeholder="How can we help?" className="w-full rounded-lg border px-4 py-3 min-h-[120px]" />
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <button type="submit" disabled={contactLoading} className="rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700">
                    {contactLoading ? 'Sending...' : 'Send Message'}
                  </button>
                  <p className="text-sm text-slate-500">We typically reply within 1 business day.</p>
                </div>
                {contactSuccess && <div className="text-sm text-emerald-700">{contactSuccess}</div>}
                {contactError && <div className="text-sm text-red-600">{contactError}</div>}
              </form>
            </ScrollReveal>
          </div>
        </div>
      </ScrollReveal>

      {/* Footer */}
      <footer className="order-9 bg-gradient-to-r from-[#0f5a3f] via-[#126847] to-[#184f3c] text-white py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src="/images/chiaralogo.png"
                  alt="Chiara Clinic Logo"
                  width={132}
                  height={132}
                  className="h-14 w-auto rounded-xl bg-white/90 px-3 py-2 shadow-sm md:h-16"
                />
              </div>
              <p className="text-emerald-100">
                Expert healthcare with Dr. Chiara C. Punzalan, M.D.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Services</h4>
              <ul className="space-y-2 text-emerald-100">
                <li>
                  <button className="hover:text-white transition">Clinic Visits</button>
                </li>
                <li>
                  <button className="hover:text-white transition">Online Consultations</button>
                </li>
                <li>
                  <button className="hover:text-white transition">Appointments</button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Hours</h4>
              <ul className="space-y-2 text-emerald-100">
                <li>Mon - Fri: 8:00 AM - 5:00 PM</li>
                <li>Sat: By Appointment</li>
                <li>Sun: Closed</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Contact</h4>
              <p className="text-emerald-100">Visit our contact section above to send a message or call us directly.</p>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 text-center text-emerald-50">
            <p>&copy; 2026 Chiara Clinic. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
