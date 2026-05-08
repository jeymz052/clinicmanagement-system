begin;

-- Add a 'CheckedIn' status between Confirmed and InProgress so the front desk
-- can record when a patient physically arrives at the clinic. Online visits
-- skip this state — they go straight from Confirmed to InProgress when the
-- doctor starts the call.
--
-- ADD VALUE IF NOT EXISTS makes this re-run safe; positioning it after
-- 'Confirmed' keeps the enum order matching the lifecycle.
alter type public.appt_status add value if not exists 'CheckedIn' after 'Confirmed';

commit;
