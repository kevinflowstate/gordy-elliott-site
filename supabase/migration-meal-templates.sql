-- Migration: Meal Templates + Nutrition Plan Type
-- Date: 2026-04-01

-- Reusable meal templates (admin-level, not per plan)
CREATE TABLE IF NOT EXISTS meal_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  foods jsonb DEFAULT '[]'::jsonb,
  total_calories numeric DEFAULT 0,
  total_protein numeric DEFAULT 0,
  total_carbs numeric DEFAULT 0,
  total_fat numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage meal templates" ON meal_templates
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- plan_type on nutrition templates
ALTER TABLE nutrition_templates ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'full'
  CHECK (plan_type IN ('full', 'macro_only'));
