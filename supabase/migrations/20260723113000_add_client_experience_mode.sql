ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS experience_mode text NOT NULL DEFAULT 'ai_coaching';

ALTER TABLE public.client_profiles
  DROP CONSTRAINT IF EXISTS client_profiles_experience_mode_check;

ALTER TABLE public.client_profiles
  ADD CONSTRAINT client_profiles_experience_mode_check
  CHECK (experience_mode IN ('founder_dashboard', 'ai_coaching'));

ALTER TABLE public.client_profiles
  DROP CONSTRAINT IF EXISTS client_profiles_founder_tier_check;

ALTER TABLE public.client_profiles
  ADD CONSTRAINT client_profiles_founder_tier_check
  CHECK (experience_mode <> 'founder_dashboard' OR tier IS DISTINCT FROM 'ai_only');

COMMENT ON COLUMN public.client_profiles.experience_mode IS
  'Controls the client portal experience independently of programme tier.';
