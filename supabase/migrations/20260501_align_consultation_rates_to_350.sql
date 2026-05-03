alter table public.doctors
  alter column consultation_fee_clinic set default 350,
  alter column consultation_fee_online set default 350;

update public.doctors
set
  consultation_fee_clinic = 350,
  consultation_fee_online = 350
where slug = 'chiara-punzalan';

alter table public.system_settings
  alter column online_consultation_fee set default 350;

update public.system_settings
set online_consultation_fee = 350
where id = true;
