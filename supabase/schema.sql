create table if not exists public.appointments (
  id text primary key,
  patient_name text not null,
  email text not null,
  phone text not null,
  doctor_id text not null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  appointment_type text not null check (appointment_type in ('Clinic', 'Online')),
  reason text not null default '',
  status text not null check (status in ('Confirmed', 'Paid', 'Pending Payment', 'Completed')),
  queue_number integer not null check (queue_number between 1 and 5),
  meeting_link text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists appointments_doctor_date_start_idx
on public.appointments (doctor_id, appointment_date, start_time);
