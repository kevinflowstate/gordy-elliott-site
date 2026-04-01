-- Migration: Training Template Enhancements
-- Date: 2026-04-01
-- Adds overview and tags to exercise_training_templates
-- Adds plan_type to nutrition_templates
-- Creates meal_templates table

ALTER TABLE exercise_training_templates ADD COLUMN IF NOT EXISTS overview text;
ALTER TABLE exercise_training_templates ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

ALTER TABLE nutrition_templates ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'full';

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
