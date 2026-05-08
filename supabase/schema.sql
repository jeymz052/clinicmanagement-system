-- =========================================================
-- CHIARA Clinic Management System — Full Schema
-- Paste into Supabase SQL Editor and Run once.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS).
-- =========================================================

-- ---------- EXTENSIONS ----------
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists citext;

-- ---------- ENUMS ----------
do $$ begin
  create type user_role as enum ('super_admin','admin','secretary','doctor','patient');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appt_type as enum ('Clinic','Online');
exception when duplicate_object then null; end $$;

do $$ begin
  create type schedule_mode as enum ('Clinic','Online','Both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appt_status as enum
    ('PendingPayment','Confirmed','CheckedIn','InProgress','Completed','Cancelled','NoShow');
exception when duplicate_object then null; end $$;

-- Re-run safety: older deployments created the enum without 'CheckedIn'.
-- Add it in place if it is missing so the schema converges either way.
do $$ begin
  alter type public.appt_status add value if not exists 'CheckedIn' after 'Confirmed';
exception when others then null; end $$;

do $$ begin
  create type payment_status as enum ('Pending','Paid','Failed','Refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('Cash','GCash','QR','Card','BankTransfer');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES (links to auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique not null,
  phone text,
  full_name text not null,
  role user_role not null default 'patient',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key references public.profiles(id) on delete cascade,
  dob date,
  gender text,
  address text,
  emergency_contact text
);

create table if not exists public.doctors (
  id uuid primary key references public.profiles(id) on delete cascade,
  specialty text not null,
  license_no text unique not null,
  consultation_fee_clinic numeric(10,2) not null default 350,
  consultation_fee_online numeric(10,2) not null default 350
);

-- Slug column for legacy UI bridge (incremental, re-run safe)
alter table public.doctors add column if not exists slug text;
create unique index if not exists doctors_slug_uidx on public.doctors(slug) where slug is not null;

-- ---------- SCHEDULES ----------
create table if not exists public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes smallint not null default 60,
  schedule_mode schedule_mode not null default 'Both',
  is_active boolean not null default true,
  check (start_time < end_time)
);

create table if not exists public.doctor_unavailability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (starts_at < ends_at),
  exclude using gist (
    doctor_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

-- ---------- APPOINTMENTS ----------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  doctor_id  uuid not null references public.doctors(id),
  appointment_date date not null,
  start_time time not null,
  end_time   time not null,
  appointment_type appt_type not null,
  status appt_status not null,
  queue_number smallint not null check (queue_number between 1 and 5),
  reason text not null default '',
  meeting_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slot_range tstzrange generated always as (
    tstzrange(
      (appointment_date + start_time) at time zone 'UTC',
      (appointment_date + end_time)   at time zone 'UTC',
      '[)'
    )
  ) stored,
  check (start_time < end_time),
  unique (doctor_id, appointment_date, start_time, queue_number)
);

create index if not exists appts_doctor_date_idx
  on public.appointments (doctor_id, appointment_date);
create index if not exists appts_patient_idx
  on public.appointments (patient_id);

-- Prevent a patient from double-booking overlapping slots
do $$ begin
  alter table public.appointments add constraint patient_no_overlap
    exclude using gist (
      patient_id with =,
      slot_range with &&
    ) where (status not in ('Cancelled','NoShow'));
exception when duplicate_object then null; end $$;

-- Prevent clinic and online appointments from sharing the same active doctor slot.
do $$ begin
  alter table public.appointments add constraint doctor_shared_slot_type_conflict
    exclude using gist (
      doctor_id with =,
      appointment_type with <>,
      slot_range with &&
    ) where (status not in ('Cancelled','NoShow'));
exception when duplicate_object then null; end $$;

create table if not exists public.online_booking_reservations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  queue_number smallint not null check (queue_number between 1 and 5),
  reason text not null default '',
  amount numeric(10,2) not null check (amount >= 0),
  status text not null check (status in ('Pending','Paid','Failed','Expired','Converted')) default 'Pending',
  payment_provider text,
  payment_ref text,
  appointment_id uuid unique references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create unique index if not exists online_booking_reservations_payment_ref_uidx
  on public.online_booking_reservations(payment_provider, payment_ref)
  where payment_ref is not null;

create unique index if not exists online_booking_reservations_doctor_slot_queue_uidx
  on public.online_booking_reservations(doctor_id, appointment_date, start_time, queue_number)
  where status in ('Pending','Paid');

-- ---------- PRICING & BILLING ----------
create table if not exists public.pricing (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  category text not null check (category in ('Consultation','Lab','Medicine','Procedure','Other')),
  price numeric(10,2) not null check (price >= 0),
  is_active boolean not null default true
);

create table if not exists public.billings (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique references public.appointments(id) on delete set null,
  patient_id uuid not null references public.patients(id),
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) generated always as (subtotal - discount + tax) stored,
  status text not null check (status in ('Draft','Issued','Paid','Void')) default 'Draft',
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

-- POS enhancements: SC/PWD discount kind + void audit (re-run safe).
alter table public.billings
  add column if not exists discount_kind text not null default 'None'
    check (discount_kind in ('None','Manual','SeniorCitizen','PWD'));
alter table public.billings add column if not exists discount_id_number text;
alter table public.billings add column if not exists voided_at timestamptz;
alter table public.billings add column if not exists voided_by uuid references public.profiles(id);
alter table public.billings add column if not exists void_reason text;

create table if not exists public.billing_items (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references public.billings(id) on delete cascade,
  pricing_id uuid references public.pricing(id),
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) generated always as (quantity * unit_price) stored
);

-- ---------- PAYMENTS ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  billing_id uuid references public.billings(id) on delete set null,
  amount numeric(10,2) not null check (amount >= 0),
  method payment_method not null,
  status payment_status not null default 'Pending',
  provider text,
  provider_ref text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (appointment_id is not null or billing_id is not null)
);

create unique index if not exists payments_provider_ref_uidx
  on public.payments(provider, provider_ref) where provider_ref is not null;

-- Tendered amount (cash received) for change-due math; null = exact tender.
alter table public.payments add column if not exists tendered_amount numeric(10,2);

-- ---------- CONSULTATION NOTES ----------
create table if not exists public.consultation_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique not null references public.appointments(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id),
  chief_complaint text,
  diagnosis text,
  prescription text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- LANDING PAGE CONTENT (singleton) ----------
-- Editable hero / about / CTA / testimonials for the public landing page.
-- See migrations/20260508_landing_content.sql for full rationale.
create table if not exists public.landing_content (
  id boolean primary key default true check (id),
  hero_eyebrow text not null default '',
  hero_title_line1 text not null default 'Your Health,',
  hero_title_line2 text not null default 'Our Priority',
  hero_subtitle text not null default 'Expert healthcare from Dr. Chiara Punzalan. Book clinic visits or online consultations with flexibility and convenience.',
  hero_cta_primary text not null default 'Book Appointment Now',
  hero_cta_secondary text not null default 'Learn More',
  hero_background_url text,
  about_eyebrow text not null default 'Meet Your Doctor',
  about_title text not null default 'Expert Healthcare Provider',
  about_subtitle text not null default 'With years of experience in general medicine and patient care',
  doctor_name text not null default 'Dra. Chiara C. Punzalan M.D.',
  doctor_title text not null default 'General Medicine Specialist',
  doctor_photo_url text,
  feature_1_title text not null default 'Professional Expertise',
  feature_1_body text not null default 'Comprehensive general medicine practice with focus on patient wellness',
  feature_2_title text not null default 'Flexible Consultation',
  feature_2_body text not null default 'Choose between clinic visits or online consultations for your convenience',
  feature_3_title text not null default 'Patient-Centered Care',
  feature_3_body text not null default 'Dedicated to understanding your health concerns and providing quality care',
  cta_title text not null default 'Ready to Schedule Your Appointment?',
  cta_subtitle text not null default 'Book now with Dr. Chiara Punzalan. Flexible scheduling for clinic and online consultations.',
  cta_button_label text not null default 'Book Appointment Now',
  testimonials jsonb not null default '[]'::jsonb,
  -- Phase 2: nav, services, how-to-book, section headers, footer
  nav_items jsonb not null default '[
    {"label":"Home","href":"#home"},
    {"label":"Services","href":"#services"},
    {"label":"About","href":"#about"},
    {"label":"Testimonials","href":"#testimonials"}
  ]'::jsonb,
  services_eyebrow text not null default 'Our Services',
  services_title text not null default 'Services & Pricing',
  services_subtitle text not null default 'Transparent pricing for both clinic and online consultations',
  services jsonb not null default '[
    {"kind":"clinic","title":"Clinic Visit","description":"In-person consultation at our facility","bullets":[
      {"title":"Direct Examination","body":"Thorough medical assessment"},
      {"title":"Face-to-Face Interaction","body":"Better for complex conditions"},
      {"title":"Prescription Services","body":"Direct access to prescriptions"}
    ]},
    {"kind":"online","title":"Online Consultation","description":"Remote consultation from the comfort of your home","bullets":[
      {"title":"Video Call","body":"Secure and private consultation"},
      {"title":"Convenient Timing","body":"Book from anywhere, anytime"},
      {"title":"Online Payment","body":"Secure PayMongo integration"}
    ]}
  ]'::jsonb,
  how_to_eyebrow text not null default 'Simple Process',
  how_to_title text not null default 'How to Book Your Appointment',
  how_to_steps jsonb not null default '[
    {"step":1,"title":"Sign In","description":"Create an account or log in to your existing account"},
    {"step":2,"title":"Choose Service","description":"Select clinic visit or online consultation"},
    {"step":3,"title":"Pick Date & Time","description":"Choose your preferred appointment slot"},
    {"step":4,"title":"Confirm & Pay","description":"Review details and complete secure payment"}
  ]'::jsonb,
  testimonials_eyebrow text not null default 'Patient Stories',
  testimonials_title text not null default 'What Patients Say',
  testimonials_subtitle text not null default 'Trusted care, thoughtful consultations, and a booking experience designed to feel simple and supportive.',
  booking_title text not null default 'Book an Appointment',
  booking_subtitle text not null default 'Use the booking widget below to pick service, date and time. You will be prompted to sign in or create an account before final confirmation.',
  contact_eyebrow text not null default 'Get in Touch',
  contact_title text not null default 'Contact Chiara Clinic',
  contact_subtitle text not null default 'Have questions or need help booking? Send us a message or call us — we''re here to help.',
  contact_info_title text not null default 'Contact Info',
  contact_hours_label text not null default 'Office Hours: Mon - Fri, 8:00 AM - 5:00 PM',
  footer_brand_blurb text not null default 'Expert healthcare with Dr. Chiara C. Punzalan, M.D.',
  footer_services jsonb not null default '["Clinic Visits","Online Consultations","Appointments"]'::jsonb,
  footer_hours jsonb not null default '["Mon - Fri: 8:00 AM - 5:00 PM","Sat: By Appointment","Sun: Closed"]'::jsonb,
  footer_contact_text text not null default 'Visit our contact section above to send a message or call us directly.',
  footer_copyright text not null default '© 2026 Chiara Clinic. All rights reserved.',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.landing_content (id) values (true) on conflict (id) do nothing;

-- ---------- VITAL SIGNS ----------
-- Captured per visit. See migrations/20260508_vital_signs.sql for the full
-- rationale. Stored separately from consultation_notes so the secretary can
-- write at check-in without column-level RLS.
create table if not exists public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique not null references public.appointments(id) on delete cascade,
  recorded_by uuid references public.profiles(id),
  bp_systolic smallint check (bp_systolic between 0 and 300),
  bp_diastolic smallint check (bp_diastolic between 0 and 200),
  temperature_c numeric(4,1) check (temperature_c between 25 and 45),
  pulse_rate smallint check (pulse_rate between 0 and 300),
  oxygen_saturation smallint check (oxygen_saturation between 0 and 100),
  respiratory_rate smallint check (respiratory_rate between 0 and 100),
  weight_kg numeric(5,2) check (weight_kg between 0 and 600),
  height_cm numeric(5,2) check (height_cm between 0 and 300),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- NOTIFICATIONS ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  template text not null,
  payload jsonb not null,
  status text not null check (status in ('queued','sent','failed')) default 'queued',
  error text,
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_due_idx
  on public.notifications(status, send_at);

-- ---------- SYSTEM SETTINGS (singleton row) ----------
create table if not exists public.system_settings (
  id boolean primary key default true check (id),
  clinic_name text not null default 'CHIARA Clinic',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  online_consultation_fee numeric(10,2) not null default 350,
  max_patients_per_hour smallint not null default 5 check (max_patients_per_hour between 1 and 20),
  clinic_open_time time not null default '08:00',
  clinic_close_time time not null default '17:00',
  updated_at timestamptz not null default now()
);
alter table public.system_settings add column if not exists clinic_open_time time not null default '08:00';
alter table public.system_settings add column if not exists clinic_close_time time not null default '17:00';
alter table public.system_settings add column if not exists default_meeting_link text not null default '';
insert into public.system_settings (id) values (true) on conflict do nothing;

-- ---------- AUDIT LOG ----------
create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  diff jsonb,
  at timestamptz not null default now()
);

-- ---------- updated_at TRIGGER ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$ begin
  create trigger trg_profiles_updated before update on public.profiles
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_appointments_updated before update on public.appointments
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_notes_updated before update on public.consultation_notes
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_vitals_updated before update on public.vital_signs
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_landing_content_updated before update on public.landing_content
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- ---------- AUTO-CREATE PROFILE ON SIGNUP ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce((new.raw_app_meta_data->>'role')::user_role, 'patient')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- AUTO-CREATE PATIENT ROW ----------
create or replace function public.handle_new_patient_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'patient' then
    insert into public.patients (id) values (new.id)
    on conflict (id) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_patient_profile();

-- ---------- RLS ----------
alter table public.profiles             enable row level security;
alter table public.patients             enable row level security;
alter table public.doctors              enable row level security;
alter table public.doctor_schedules     enable row level security;
alter table public.doctor_unavailability enable row level security;
alter table public.appointments         enable row level security;
alter table public.consultation_notes   enable row level security;
alter table public.vital_signs           enable row level security;
alter table public.landing_content       enable row level security;
alter table public.billings             enable row level security;
alter table public.billing_items        enable row level security;
alter table public.payments             enable row level security;
alter table public.online_booking_reservations enable row level security;
alter table public.pricing              enable row level security;
alter table public.notifications        enable row level security;
alter table public.system_settings      enable row level security;

-- Helper: role check
create or replace function public.current_role() returns user_role
language sql stable as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable as $$
  select public.current_role() in ('admin','secretary','super_admin')
$$;

-- PROFILES
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() or public.is_staff());

-- PATIENTS
drop policy if exists patients_self_read on public.patients;
create policy patients_self_read on public.patients for select
  using (id = auth.uid() or public.current_role() in ('doctor','admin','secretary','super_admin'));

drop policy if exists patients_staff_write on public.patients;
create policy patients_staff_write on public.patients for all
  using (public.is_staff()) with check (public.is_staff());

-- DOCTORS
drop policy if exists doctors_read_all on public.doctors;
create policy doctors_read_all on public.doctors for select using (true);

drop policy if exists doctors_admin_write on public.doctors;
create policy doctors_admin_write on public.doctors for all
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- SCHEDULES
drop policy if exists schedules_read_all on public.doctor_schedules;
create policy schedules_read_all on public.doctor_schedules for select using (true);

drop policy if exists schedules_doctor_write on public.doctor_schedules;
create policy schedules_doctor_write on public.doctor_schedules for all
  using (doctor_id = auth.uid() or public.is_staff())
  with check (doctor_id = auth.uid() or public.is_staff());

drop policy if exists unavail_read_all on public.doctor_unavailability;
create policy unavail_read_all on public.doctor_unavailability for select using (true);

drop policy if exists unavail_doctor_write on public.doctor_unavailability;
create policy unavail_doctor_write on public.doctor_unavailability for all
  using (doctor_id = auth.uid() or public.is_staff())
  with check (doctor_id = auth.uid() or public.is_staff());

-- APPOINTMENTS
drop policy if exists appts_participant_read on public.appointments;
create policy appts_participant_read on public.appointments for select
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_staff());

drop policy if exists appts_patient_insert on public.appointments;
create policy appts_patient_insert on public.appointments for insert
  with check (patient_id = auth.uid() or public.is_staff());

drop policy if exists appts_update on public.appointments;
create policy appts_update on public.appointments for update
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_staff());

-- CONSULTATION NOTES
drop policy if exists notes_read on public.consultation_notes;
create policy notes_read on public.consultation_notes for select
  using (doctor_id = auth.uid() or public.is_staff()
         or exists (select 1 from public.appointments a
                    where a.id = appointment_id and a.patient_id = auth.uid()));

drop policy if exists notes_doctor_write on public.consultation_notes;
create policy notes_doctor_write on public.consultation_notes for all
  using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());

-- VITAL SIGNS (secretary at check-in OR doctor during consultation)
drop policy if exists vitals_read on public.vital_signs;
create policy vitals_read on public.vital_signs for select
  using (
    public.is_staff()
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and (a.patient_id = auth.uid() or a.doctor_id = auth.uid())
    )
  );

drop policy if exists vitals_clinic_write on public.vital_signs;
create policy vitals_clinic_write on public.vital_signs for all
  using (
    public.is_staff()
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.doctor_id = auth.uid()
    )
  )
  with check (
    public.is_staff()
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.doctor_id = auth.uid()
    )
  );

-- LANDING CONTENT (public read, super_admin/doctor write)
drop policy if exists landing_read on public.landing_content;
create policy landing_read on public.landing_content for select
  using (true);

drop policy if exists landing_write on public.landing_content;
create policy landing_write on public.landing_content for all
  using (public.current_role() in ('super_admin', 'doctor'))
  with check (public.current_role() in ('super_admin', 'doctor'));

-- BILLINGS / ITEMS / PAYMENTS (staff-only write; patient reads own)
drop policy if exists billings_read on public.billings;
create policy billings_read on public.billings for select
  using (patient_id = auth.uid() or public.is_staff() or public.current_role() = 'doctor');

drop policy if exists billings_staff_write on public.billings;
create policy billings_staff_write on public.billings for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists items_read on public.billing_items;
create policy items_read on public.billing_items for select
  using (exists (select 1 from public.billings b
                 where b.id = billing_id
                   and (b.patient_id = auth.uid() or public.is_staff()
                        or public.current_role() = 'doctor')));

drop policy if exists items_staff_write on public.billing_items;
create policy items_staff_write on public.billing_items for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (public.is_staff()
         or exists (select 1 from public.appointments a
                    where a.id = appointment_id and a.patient_id = auth.uid()));

drop policy if exists payments_staff_write on public.payments;
create policy payments_staff_write on public.payments for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists reservation_read on public.online_booking_reservations;
create policy reservation_read on public.online_booking_reservations for select
  using (patient_id = auth.uid() or public.is_staff());

drop policy if exists reservation_staff_write on public.online_booking_reservations;
create policy reservation_staff_write on public.online_booking_reservations for all
  using (public.is_staff()) with check (public.is_staff());

-- PRICING
drop policy if exists pricing_read_all on public.pricing;
create policy pricing_read_all on public.pricing for select using (true);

drop policy if exists pricing_admin_write on public.pricing;
create policy pricing_admin_write on public.pricing for all
  using (public.is_staff()) with check (public.is_staff());

-- NOTIFICATIONS
drop policy if exists notif_self_read on public.notifications;
create policy notif_self_read on public.notifications for select
  using (user_id = auth.uid() or public.is_staff());

-- SYSTEM SETTINGS
drop policy if exists settings_read_all on public.system_settings;
create policy settings_read_all on public.system_settings for select using (true);

drop policy if exists settings_admin_write on public.system_settings;
create policy settings_admin_write on public.system_settings for update
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
