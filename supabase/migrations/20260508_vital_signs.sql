-- Vital signs captured per visit (per appointment).
--
-- Why a separate table from consultation_notes:
--   * Different ownership: secretary captures vitals at check-in; doctor
--     writes the clinical note during consultation. Splitting tables lets us
--     give each party its own RLS instead of column-level grants.
--   * Vitals can exist without a clinical note (patient walks out before
--     the doctor sees them).
--
-- One-to-one with appointment: `appointment_id unique` enforces a single
-- row per visit so editors can safely upsert on conflict.
--
-- Range checks reflect physiological plausibility, not strict normality, so
-- the doctor can record an emergency reading (e.g., 200/120 BP) without
-- being blocked by the constraint.

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

-- Reuse the shared updated_at trigger function defined in schema.sql.
do $$ begin
  create trigger trg_vitals_updated before update on public.vital_signs
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

alter table public.vital_signs enable row level security;

-- Read: staff (super_admin, secretary), the assigned doctor, or the patient
-- who owns the appointment.
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

-- Write: staff (front desk takes vitals at check-in) or the assigned doctor
-- (re-takes / corrects during consultation). Patients never write.
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
