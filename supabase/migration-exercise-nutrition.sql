-- ============================================================
-- Migration: Exercise Plans + Nutrition Plans
-- Date: 2026-03-30
-- Tables: 15 new tables + RLS policies + indexes
-- ============================================================

-- ============================================
-- 1. EXERCISE LIBRARY
-- ============================================

CREATE TABLE exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  muscle_group text NOT NULL,
  equipment text NOT NULL DEFAULT 'bodyweight',
  description text,
  video_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX idx_exercises_equipment ON exercises(equipment);

-- ============================================
-- 2. EXERCISE TRAINING TEMPLATES
-- ============================================

CREATE TABLE exercise_training_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  duration_weeks integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exercise_training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES exercise_training_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_number integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_training_sessions_template ON exercise_training_sessions(template_id);

CREATE TABLE exercise_training_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES exercise_training_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  sets integer NOT NULL DEFAULT 3,
  reps text NOT NULL DEFAULT '10',
  rest_seconds integer DEFAULT 60,
  tempo text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_session_items_session ON exercise_training_session_items(session_id);

-- ============================================
-- 3. CLIENT EXERCISE PLANS (assigned copies)
-- ============================================

CREATE TABLE client_exercise_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES exercise_training_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_exercise_plans_client ON client_exercise_plans(client_id);

CREATE TABLE client_exercise_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES client_exercise_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_number integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_exercise_sessions_plan ON client_exercise_sessions(plan_id);

CREATE TABLE client_exercise_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES client_exercise_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  sets integer NOT NULL DEFAULT 3,
  reps text NOT NULL DEFAULT '10',
  rest_seconds integer DEFAULT 60,
  tempo text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_exercise_items_session ON client_exercise_session_items(session_id);

-- ============================================
-- 4. FOOD LIBRARY
-- ============================================

CREATE TABLE foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  serving_size text NOT NULL DEFAULT '100g',
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric(6,1) NOT NULL DEFAULT 0,
  carbs_g numeric(6,1) NOT NULL DEFAULT 0,
  fat_g numeric(6,1) NOT NULL DEFAULT 0,
  fibre_g numeric(6,1) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_foods_category ON foods(category);

-- ============================================
-- 5. NUTRITION TEMPLATES
-- ============================================

CREATE TABLE nutrition_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  calorie_range text NOT NULL DEFAULT 'moderate',
  target_calories integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nutrition_template_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES nutrition_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nutrition_template_meals_template ON nutrition_template_meals(template_id);

CREATE TABLE nutrition_template_meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES nutrition_template_meals(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  quantity numeric(8,2) NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nutrition_template_meal_items_meal ON nutrition_template_meal_items(meal_id);

-- ============================================
-- 6. CLIENT NUTRITION PLANS (assigned copies)
-- ============================================

CREATE TABLE client_nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES nutrition_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  target_calories integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,
  start_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_nutrition_plans_client ON client_nutrition_plans(client_id);

CREATE TABLE client_nutrition_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES client_nutrition_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_nutrition_meals_plan ON client_nutrition_meals(plan_id);

CREATE TABLE client_nutrition_meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES client_nutrition_meals(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  quantity numeric(8,2) NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_nutrition_meal_items_meal ON client_nutrition_meal_items(meal_id);

-- ============================================
-- 7. CLIENT MEAL TRACKING
-- ============================================

CREATE TABLE client_meal_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  meal_id uuid NOT NULL REFERENCES client_nutrition_meals(id) ON DELETE CASCADE,
  tracked_date date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, meal_id, tracked_date)
);

CREATE INDEX idx_client_meal_tracking_client_date ON client_meal_tracking(client_id, tracked_date);

-- ============================================
-- 8. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_training_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_training_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_exercise_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_exercise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_exercise_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_template_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_template_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_nutrition_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_nutrition_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_meal_tracking ENABLE ROW LEVEL SECURITY;

-- Libraries: all authenticated can read
CREATE POLICY "exercises_read" ON exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "foods_read" ON foods FOR SELECT TO authenticated USING (true);

-- Templates: all authenticated can read
CREATE POLICY "exercise_templates_read" ON exercise_training_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "exercise_sessions_read" ON exercise_training_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "exercise_session_items_read" ON exercise_training_session_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrition_templates_read" ON nutrition_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrition_template_meals_read" ON nutrition_template_meals FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrition_template_meal_items_read" ON nutrition_template_meal_items FOR SELECT TO authenticated USING (true);

-- Client exercise plans: clients read own
CREATE POLICY "client_exercise_plans_read" ON client_exercise_plans
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));

CREATE POLICY "client_exercise_sessions_read" ON client_exercise_sessions
  FOR SELECT TO authenticated
  USING (plan_id IN (SELECT id FROM client_exercise_plans WHERE client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid())));

CREATE POLICY "client_exercise_items_read" ON client_exercise_session_items
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM client_exercise_sessions WHERE plan_id IN (SELECT id FROM client_exercise_plans WHERE client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()))));

-- Client nutrition plans: clients read own
CREATE POLICY "client_nutrition_plans_read" ON client_nutrition_plans
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));

CREATE POLICY "client_nutrition_meals_read" ON client_nutrition_meals
  FOR SELECT TO authenticated
  USING (plan_id IN (SELECT id FROM client_nutrition_plans WHERE client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid())));

CREATE POLICY "client_nutrition_meal_items_read" ON client_nutrition_meal_items
  FOR SELECT TO authenticated
  USING (meal_id IN (SELECT id FROM client_nutrition_meals WHERE plan_id IN (SELECT id FROM client_nutrition_plans WHERE client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()))));

-- Meal tracking: clients can read + insert + update own
CREATE POLICY "meal_tracking_select" ON client_meal_tracking
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));

CREATE POLICY "meal_tracking_insert" ON client_meal_tracking
  FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));

CREATE POLICY "meal_tracking_update" ON client_meal_tracking
  FOR UPDATE TO authenticated
  USING (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));
