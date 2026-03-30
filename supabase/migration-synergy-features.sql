-- Synergy-inspired features: food photos, body measurements, personal meals
-- Run in Supabase SQL Editor (Part 1)

-- 1. Add photo_url to foods table
ALTER TABLE foods ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Client body measurements (tracking over time)
CREATE TABLE IF NOT EXISTS client_body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  measured_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,1),
  height_cm NUMERIC(5,1),
  body_fat_percent NUMERIC(4,1),
  chest_cm NUMERIC(5,1),
  waist_cm NUMERIC(5,1),
  hip_cm NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, measured_date)
);

-- 3. Client quick meals (ad-hoc food tracking per day)
CREATE TABLE IF NOT EXISTS client_quick_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  tracked_date DATE NOT NULL,
  name TEXT NOT NULL,
  calories NUMERIC(7,1) NOT NULL DEFAULT 0,
  protein_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  carbs_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  fat_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Client saved meal presets (reusable quick meals)
CREATE TABLE IF NOT EXISTS client_saved_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories NUMERIC(7,1) NOT NULL DEFAULT 0,
  protein_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  carbs_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  fat_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_body_measurements_client ON client_body_measurements(client_id);
CREATE INDEX IF NOT EXISTS idx_quick_meals_client_date ON client_quick_meals(client_id, tracked_date);
CREATE INDEX IF NOT EXISTS idx_saved_meals_client ON client_saved_meals(client_id);
