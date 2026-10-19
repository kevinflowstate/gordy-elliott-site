-- Nullable: absent provider nutrients are unknown, not zero.
ALTER TABLE public.client_wearable_daily_summaries
  ADD COLUMN IF NOT EXISTS fibre_g NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS sugar_g NUMERIC(8,2);
