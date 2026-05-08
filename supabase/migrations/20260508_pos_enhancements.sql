begin;

-- Discount kind so Senior Citizen and PWD discounts (RA 9994 / RA 10754:
-- 20% off + VAT exempt) are legible to the receipt and the 20% math can be
-- enforced server-side instead of typed by the cashier.
alter table public.billings
  add column if not exists discount_kind text not null default 'None'
    check (discount_kind in ('None','Manual','SeniorCitizen','PWD'));
alter table public.billings
  add column if not exists discount_id_number text;

-- Void / refund audit trail. The 'Void' billing status already exists; these
-- columns capture who voided, when, and why so a paid bill can be reversed
-- through the UI instead of via SQL.
alter table public.billings
  add column if not exists voided_at timestamptz;
alter table public.billings
  add column if not exists voided_by uuid references public.profiles(id);
alter table public.billings
  add column if not exists void_reason text;

-- Tendered amount (cash received) so the POS can compute change. Optional —
-- non-cash methods leave it null and assume exact amount.
alter table public.payments
  add column if not exists tendered_amount numeric(10,2);

commit;
