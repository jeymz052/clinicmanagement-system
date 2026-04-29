begin;

-- Normalize any legacy clinic approval records before removing the enum value.
update public.appointments
set status = 'Confirmed'
where status = 'PendingApproval';

-- Rebuild the appointment status enum without PendingApproval.
alter type public.appt_status rename to appt_status_old;

create type public.appt_status as enum (
  'PendingPayment',
  'Confirmed',
  'InProgress',
  'Completed',
  'Cancelled',
  'NoShow'
);

alter table public.appointments
  alter column status type public.appt_status
  using status::text::public.appt_status;

drop type public.appt_status_old;

commit;
