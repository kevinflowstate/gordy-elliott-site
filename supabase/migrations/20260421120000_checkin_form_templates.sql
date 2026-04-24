-- Check-in form admin UX compatibility
-- The remote project already has `checkin_forms` and `checkin_form_id`.
-- This migration only adds metadata needed by the richer builder UI.

ALTER TABLE public.checkin_forms
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
