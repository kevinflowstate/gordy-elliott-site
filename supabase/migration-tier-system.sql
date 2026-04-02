-- Migration: AI Tier System
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'coached' CHECK (tier IN ('coached', 'ai_only'));
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS consultation_data JSONB;
CREATE INDEX IF NOT EXISTS idx_client_profiles_tier ON public.client_profiles(tier);
