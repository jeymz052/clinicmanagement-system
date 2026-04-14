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
  create type appt_status as enum
    ('PendingPayment','Confirmed','InProgress','Completed','Cancelled','NoShow');
exception when duplicate_object then null; end $$;

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
  consultation_fee_clinic numeric(10,2) not null default 0,
  consultation_fee_online numeric(10,2) not null default 0
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
  online_consultation_fee numeric(10,2) not null default 0,
  max_patients_per_hour smallint not null default 5 check (max_patients_per_hour between 1 and 20),
  updated_at timestamptz not null default now()
);
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

-- ---------- AUTO-CREATE PROFILE ON SIGNUP ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'patient')
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
alter table public.billings             enable row level security;
alter table public.billing_items        enable row level security;
alter table public.payments             enable row level security;
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
