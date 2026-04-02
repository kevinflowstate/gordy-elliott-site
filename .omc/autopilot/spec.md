# Technical Specification: Training Plan Builder + Nutrition Plan Builder
## Gordy Elliott Portal (`gordy-elliott-site`)

**Date:** 2026-03-30
**Supabase Project:** `yeflmlcpqdfsfjlxofqy` (Frankfurt)
**Stack:** Next.js 16 + React 19 + Supabase + Tailwind 4

---

## 0. Bug Fix (Do First)

**Problem:** Frontend calls `/api/admin/training-plans` but the API route lives at `/api/admin/business-plans`.

**Files calling the wrong endpoint (6 call sites):**
- `app/admin/clients/[id]/page.tsx:247` - `fetch("/api/admin/training-plans", ...)`
- `app/admin/clients/[id]/page.tsx:255` - `fetch("/api/admin/training-plans", ...)`
- `app/admin/training-plans/page.tsx:38` - `fetch("/api/admin/training-plans")`
- `app/admin/training-plans/page.tsx:57` - `fetch("/api/admin/training-plans", ...)`
- `app/admin/training-plans/page.tsx:65` - `fetch("/api/admin/training-plans", ...)`
- `app/admin/training-plans/page.tsx:267` - `fetch("/api/admin/training-plans", ...)`

**Fix:** Create a new route file at `app/api/admin/training-plans/route.ts` that re-exports from the business-plans route:

```ts
// app/api/admin/training-plans/route.ts
export { GET, POST } from "@/app/api/admin/business-plans/route";
```

This is the lowest-risk fix. The underlying data layer stays at `business-plans` (DB tables are `business_plans`, `business_plan_phases`, etc.), but the frontend gets its expected endpoint.

---

## 1. New Dependencies

Install these exact packages:

```bash
npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2 recharts@^2.15.3
```

**Why each is needed:**
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` - Drag-and-drop reordering for exercise sessions, exercises within sessions, meals, and food items within meals
- `recharts` - Macro breakdown pie/donut chart on client nutrition view and admin nutrition overview

**No other dependencies required.** The project already has everything else needed (Supabase client, Next.js app router, Tailwind 4).

---

## 2. Database Schema - New Tables

All tables use `uuid` primary keys with `gen_random_uuid()` default. All timestamps are `timestamptz` with `now()` default. All tables belong to the `public` schema.

### 2.1 Exercise Library

```sql
-- Global exercise library (seeded, admin can add more)
CREATE TABLE exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  muscle_group text NOT NULL,          -- 'chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'full_body', 'other'
  equipment text NOT NULL DEFAULT 'none', -- 'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'none', 'other'
  description text,
  video_url text,                       -- Optional demo video link
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX idx_exercises_equipment ON exercises(equipment);
```

### 2.2 Exercise Training Templates (Admin-built reusable programs)

```sql
-- Template metadata
CREATE TABLE exercise_training_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                   -- e.g. "4-Week Beginner Strength"
  description text,
  category text NOT NULL DEFAULT 'general', -- 'strength', 'hypertrophy', 'conditioning', 'flexibility', 'general'
  duration_weeks integer,               -- Suggested programme length
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sessions within a template (e.g. "Day 1 - Push", "Day 2 - Pull")
CREATE TABLE exercise_training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES exercise_training_templates(id) ON DELETE CASCADE,
  name text NOT NULL,                   -- e.g. "Day 1 - Upper Push"
  day_number integer NOT NULL,          -- 1, 2, 3... for ordering
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_training_sessions_template ON exercise_training_sessions(template_id);

-- Exercises within a session (the actual workout content)
CREATE TABLE exercise_training_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES exercise_training_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  sets integer NOT NULL DEFAULT 3,
  reps text NOT NULL DEFAULT '10',       -- text to allow "8-12", "AMRAP", "30s"
  rest_seconds integer DEFAULT 60,
  tempo text,                            -- e.g. "3-1-1-0"
  notes text,                            -- e.g. "Superset with next exercise"
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_session_items_session ON exercise_training_session_items(session_id);
```

### 2.3 Client Exercise Plans (Assigned copies)

```sql
-- Copy of template assigned to a specific client
CREATE TABLE client_exercise_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES exercise_training_templates(id) ON DELETE SET NULL, -- null if template deleted
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_exercise_plans_client ON client_exercise_plans(client_id);

-- Copy of sessions for the client
CREATE TABLE client_exercise_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES client_exercise_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_number integer NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_exercise_sessions_plan ON client_exercise_sessions(plan_id);

-- Copy of items for the client (editable per-client)
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
```

### 2.4 Food Library

```sql
-- Global food library (seeded, admin can add more)
CREATE TABLE foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,               -- 'protein', 'carbs', 'fats', 'dairy', 'fruit', 'vegetables', 'grains', 'snacks', 'drinks', 'supplements', 'other'
  serving_size text NOT NULL DEFAULT '100g', -- e.g. "100g", "1 scoop", "1 medium"
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric(6,1) NOT NULL DEFAULT 0,
  carbs_g numeric(6,1) NOT NULL DEFAULT 0,
  fat_g numeric(6,1) NOT NULL DEFAULT 0,
  fibre_g numeric(6,1) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_foods_category ON foods(category);
```

### 2.5 Nutrition Templates (Admin-built reusable meal plans)

```sql
-- Template metadata
CREATE TABLE nutrition_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- e.g. "1800cal Fat Loss - Female"
  description text,
  calorie_range text NOT NULL DEFAULT 'moderate', -- 'low' (<1500), 'moderate' (1500-2200), 'high' (2200+), 'custom'
  target_calories integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Meals within a template (e.g. "Breakfast", "Snack 1", "Lunch")
CREATE TABLE nutrition_template_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES nutrition_templates(id) ON DELETE CASCADE,
  name text NOT NULL,                    -- "Breakfast", "Lunch", "Dinner", "Snack 1"
  order_index integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nutrition_template_meals_template ON nutrition_template_meals(template_id);

-- Food items within a meal
CREATE TABLE nutrition_template_meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES nutrition_template_meals(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  quantity numeric(8,2) NOT NULL DEFAULT 1, -- multiplier of serving_size
  order_index integer NOT NULL DEFAULT 0,
  notes text,                            -- e.g. "or swap for Greek yoghurt"
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nutrition_template_meal_items_meal ON nutrition_template_meal_items(meal_id);
```

### 2.6 Client Nutrition Plans (Assigned copies)

```sql
-- Copy of nutrition template assigned to client
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

-- Copy of meals for the client
CREATE TABLE client_nutrition_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES client_nutrition_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_nutrition_meals_plan ON client_nutrition_meals(plan_id);

-- Copy of food items for the client (editable per-client)
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
```

### 2.7 Client Meal Tracking (Daily compliance)

```sql
-- Daily tick/untick per meal (one row per client per meal per day)
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
```

---

## 3. RLS Policies

The codebase uses `createAdminClient()` (service role key) for ALL data operations, which bypasses RLS entirely. This is the established pattern across the entire portal (see `lib/supabase/admin.ts:1-8`, used in `lib/admin-data.ts`, all API routes).

**Policy:** Enable RLS on all new tables for defence-in-depth, but keep the policies simple since all actual queries use the service role key.

```sql
-- Enable RLS on all new tables
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

-- Admin (service_role) bypasses RLS automatically.
-- For anon/authenticated: read-only on library tables, own-data on client tables.

-- Exercise library: all authenticated users can read
CREATE POLICY "exercises_read" ON exercises FOR SELECT TO authenticated USING (true);

-- Food library: all authenticated users can read
CREATE POLICY "foods_read" ON foods FOR SELECT TO authenticated USING (true);

-- Templates: all authenticated users can read
CREATE POLICY "exercise_templates_read" ON exercise_training_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "exercise_sessions_read" ON exercise_training_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "exercise_session_items_read" ON exercise_training_session_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrition_templates_read" ON nutrition_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrition_template_meals_read" ON nutrition_template_meals FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrition_template_meal_items_read" ON nutrition_template_meal_items FOR SELECT TO authenticated USING (true);

-- Client exercise plans: clients can read their own
CREATE POLICY "client_exercise_plans_read" ON client_exercise_plans
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));

CREATE POLICY "client_exercise_sessions_read" ON client_exercise_sessions
  FOR SELECT TO authenticated
  USING (plan_id IN (SELECT id FROM client_exercise_plans WHERE client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid())));

CREATE POLICY "client_exercise_items_read" ON client_exercise_session_items
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM client_exercise_sessions WHERE plan_id IN (SELECT id FROM client_exercise_plans WHERE client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()))));

-- Client nutrition plans: clients can read their own
CREATE POLICY "client_nutrition_plans_read" ON client_nutrition_plans
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));

CREATE POLICY "client_nutrition_meals_read" ON client_nutrition_meals
  FOR SELECT TO authenticated
  USING (plan_id IN (SELECT id FROM client_nutrition_plans WHERE client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid())));

CREATE POLICY "client_nutrition_meal_items_read" ON client_nutrition_meal_items
  FOR SELECT TO authenticated
  USING (meal_id IN (SELECT id FROM client_nutrition_meals WHERE plan_id IN (SELECT id FROM client_nutrition_plans WHERE client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()))));

-- Meal tracking: clients can read + insert + update their own
CREATE POLICY "meal_tracking_select" ON client_meal_tracking
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));

CREATE POLICY "meal_tracking_insert" ON client_meal_tracking
  FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));

CREATE POLICY "meal_tracking_update" ON client_meal_tracking
  FOR UPDATE TO authenticated
  USING (client_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));
```

---

## 4. New API Routes

All admin routes use `requireAdmin()` guard (pattern from `lib/admin-auth.ts`). All use `createAdminClient()` for DB ops.

### 4.1 Exercise Library

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/exercises` | List all exercises (filterable by muscle_group, equipment) |
| `POST` | `/api/admin/exercises` | Create a new exercise |
| `PATCH` | `/api/admin/exercises` | Update an exercise (body: `{ id, ...fields }`) |
| `DELETE` | `/api/admin/exercises` | Soft-delete (set `is_active = false`, body: `{ id }`) |

### 4.2 Exercise Templates

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/exercise-templates` | List all templates with nested sessions + items |
| `POST` | `/api/admin/exercise-templates` | Create/update a full template (upsert pattern like `savePlan` in `admin-data.ts`) |
| `DELETE` | `/api/admin/exercise-templates` | Soft-delete template (body: `{ id }`) |

### 4.3 Client Exercise Plans

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/client-exercise-plans?clientId=X` | Get client's exercise plans |
| `POST` | `/api/admin/client-exercise-plans` | Assign template to client (deep copy) or update existing plan |
| `PATCH` | `/api/admin/client-exercise-plans` | Change status (`active`/`completed`/`archived`) |

### 4.4 Food Library

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/foods` | List all foods (filterable by category) |
| `POST` | `/api/admin/foods` | Create a new food item |
| `PATCH` | `/api/admin/foods` | Update a food item |
| `DELETE` | `/api/admin/foods` | Soft-delete (set `is_active = false`) |

### 4.5 Nutrition Templates

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/nutrition-templates` | List all templates with nested meals + items + computed macros |
| `POST` | `/api/admin/nutrition-templates` | Create/update a full template (upsert pattern) |
| `DELETE` | `/api/admin/nutrition-templates` | Soft-delete template |

### 4.6 Client Nutrition Plans

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/client-nutrition-plans?clientId=X` | Get client's nutrition plans |
| `POST` | `/api/admin/client-nutrition-plans` | Assign template to client (deep copy) or update |
| `PATCH` | `/api/admin/client-nutrition-plans` | Change status |

### 4.7 Portal Routes (Client-facing)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/portal/exercise-plan` | Get current client's active exercise plan with all sessions + items + exercise details |
| `GET` | `/api/portal/nutrition-plan` | Get current client's active nutrition plan with meals + items + food details + today's tracking |
| `POST` | `/api/portal/meal-tracking` | Toggle a meal's completion for today (body: `{ meal_id, completed, date? }`) |

### 4.8 Bug Fix Route

| Method | Path | Purpose |
|--------|------|---------|
| `GET/POST` | `/api/admin/training-plans` | Re-export from `/api/admin/business-plans` (see section 0) |

---

## 5. New Pages

### 5.1 Admin Pages

| Path | Purpose |
|------|---------|
| `app/admin/exercise-library/page.tsx` | Browse/search/add/edit exercises. Filterable table with muscle group + equipment filters. Inline add row at top. |
| `app/admin/exercise-plans/page.tsx` | List all exercise templates. Create/edit templates. Each template opens a builder (modal or inline). Shows which clients are assigned to each template. |
| `app/admin/food-library/page.tsx` | Browse/search/add/edit foods. Filterable table with category filter. Shows macros per serving. Inline add row. |
| `app/admin/nutrition-plans/page.tsx` | List all nutrition templates. Create/edit templates. Meal builder with food picker. Shows macro totals per template. |

### 5.2 Portal Pages (Client-facing)

| Path | Purpose |
|------|---------|
| `app/portal/exercise-plan/page.tsx` | View assigned exercise plan. Expandable sessions showing exercises with sets/reps/rest/tempo/notes. No editing - read-only. |
| `app/portal/nutrition-plan/page.tsx` | View assigned nutrition plan. Macro targets at top (donut chart via recharts). Expandable meals. Daily tracking checkboxes per meal. Weekly compliance bar. |

---

## 6. New Components

### 6.1 Exercise Components

| Component | Location | Purpose | Key Props |
|-----------|----------|---------|-----------|
| `ExerciseLibraryTable` | `components/admin/ExerciseLibraryTable.tsx` | Filterable, searchable table of exercises with inline add/edit | `exercises: Exercise[], onSave, onDelete` |
| `ExerciseTemplatePicker` | `components/admin/ExerciseTemplatePicker.tsx` | Dropdown/modal to select a template when assigning to client | `templates: ExerciseTemplate[], onSelect: (id) => void` |
| `ExerciseTemplateBuilder` | `components/admin/ExerciseTemplateBuilder.tsx` | Full builder for creating/editing exercise templates. DnD sessions, DnD items within sessions. Exercise picker per row. | `template?: ExerciseTemplate, exercises: Exercise[], onSave, onCancel` |
| `ExercisePicker` | `components/admin/ExercisePicker.tsx` | Search/filter modal to pick an exercise from library (used inside template builder) | `exercises: Exercise[], onPick: (exercise) => void, onClose` |
| `ClientExercisePlanCard` | `components/admin/ClientExercisePlanCard.tsx` | Collapsible card showing client's assigned exercise plan on client detail page | `plan: ClientExercisePlan, onArchive, onEdit` |
| `PortalExercisePlan` | `components/portal/ExercisePlan.tsx` | Client-facing read-only view of their exercise plan with expandable sessions | `plan: ClientExercisePlan` |

### 6.2 Nutrition Components

| Component | Location | Purpose | Key Props |
|-----------|----------|---------|-----------|
| `FoodLibraryTable` | `components/admin/FoodLibraryTable.tsx` | Filterable, searchable table of foods with inline add/edit. Shows kcal/protein/carbs/fat per serving. | `foods: Food[], onSave, onDelete` |
| `NutritionTemplatePicker` | `components/admin/NutritionTemplatePicker.tsx` | Dropdown/modal to select a nutrition template when assigning to client | `templates: NutritionTemplate[], onSelect` |
| `NutritionTemplateBuilder` | `components/admin/NutritionTemplateBuilder.tsx` | Full builder for meal plans. DnD meals, DnD food items within meals. Food picker per row. Live macro totals. | `template?: NutritionTemplate, foods: Food[], onSave, onCancel` |
| `FoodPicker` | `components/admin/FoodPicker.tsx` | Search/filter modal to pick a food from library | `foods: Food[], onPick: (food) => void, onClose` |
| `MacroSummaryBar` | `components/admin/MacroSummaryBar.tsx` | Horizontal bar showing kcal / P / C / F totals vs targets. Used in template builder + client plan view. | `actual: Macros, target?: Macros` |
| `ClientNutritionPlanCard` | `components/admin/ClientNutritionPlanCard.tsx` | Collapsible card showing client's assigned nutrition plan on client detail page | `plan: ClientNutritionPlan, onArchive, onEdit` |
| `PortalNutritionPlan` | `components/portal/NutritionPlan.tsx` | Client-facing view with macro chart, expandable meals, daily checkboxes | `plan, tracking, onToggleMeal` |
| `MacroDonutChart` | `components/portal/MacroDonutChart.tsx` | recharts PieChart showing protein/carbs/fat split | `protein: number, carbs: number, fat: number` |
| `MealTracker` | `components/portal/MealTracker.tsx` | Daily meal checklist with tick/untick per meal. Shows compliance streak. | `meals: Meal[], tracking: TrackingMap, onToggle` |

### 6.3 Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DndSortableList` | `components/ui/DndSortableList.tsx` | Reusable wrapper around @dnd-kit sortable for vertical lists. Handles drag overlay + reorder callback. Used by both template builders. |

---

## 7. Navigation Updates

### 7.1 AdminSidebar (`components/admin/AdminSidebar.tsx`)

Current `navItems` array has 7 items. Add 2 new items after "Training Plans" (index 2):

```ts
// Insert at index 3 (after Training Plans)
{ href: "/admin/exercise-plans", label: "Exercise Plans", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
// Insert at index 4 (after Exercise Plans)  
{ href: "/admin/nutrition-plans", label: "Nutrition Plans", icon: "M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 9.75l-3-3m0 0l-3 3m3-3v12" },
```

The library pages (exercise-library, food-library) are NOT in the sidebar. They are accessed from within the exercise-plans and nutrition-plans pages via a "Manage Library" button. This keeps the sidebar clean at 9 items total (acceptable).

### 7.2 Portal Sidebar (`components/portal/Sidebar.tsx`)

Current `navItems` array has 7 items. Add 2 new items after "Training Plan" (index 1):

```ts
// Insert at index 2 (after Training Plan)
{ href: "/portal/exercise-plan", label: "Exercise Plan", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
// Insert at index 3 (after Exercise Plan)
{ href: "/portal/nutrition-plan", label: "Nutrition", icon: "M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 9.75l-3-3m0 0l-3 3m3-3v12" },
```

### 7.3 MobileNav (`components/portal/MobileNav.tsx`)

Current `items` array has 7 items and `h-14` height. 9 items will overflow on small screens.

**Strategy:** Keep 7 items in the bottom bar. Replace "Settings" (least used on mobile) with a "More" menu that contains Settings + the two new pages. Or: keep the 5 most important items visible, put rest in "More".

**Recommended approach (keep it simple):** Show 5 items in bottom bar: Home, Exercise Plan, Nutrition, Check-In, More. "More" opens a small popup sheet with: Training Plan, Training, Calendar, AI, Settings.

```ts
const visibleItems = [
  { href: "/portal", label: "Home", icon: "..." },
  { href: "/portal/exercise-plan", label: "Workout", icon: "..." },
  { href: "/portal/nutrition-plan", label: "Nutrition", icon: "..." },
  { href: "/portal/checkin", label: "Check-In", icon: "..." },
  { href: "#more", label: "More", icon: "M4 6h16M4 12h16M4 18h16" }, // hamburger
];

const moreItems = [
  { href: "/portal/plan", label: "Training Plan", icon: "..." },
  { href: "/portal/training", label: "Training", icon: "..." },
  { href: "/portal/calendar", label: "Calendar", icon: "..." },
  { href: "/portal/ai", label: "SHIFT AI", icon: "..." },
  { href: "/portal/settings", label: "Settings", icon: "..." },
];
```

The "More" tap toggles a slide-up panel. Keep `h-14` for the bar itself.

### 7.4 Client Detail Page Updates (`app/admin/clients/[id]/page.tsx`)

Add two new collapsible sections below the existing Training Plan section:

1. **Exercise Plan section** - Shows `ClientExercisePlanCard` if assigned, or "Assign Exercise Plan" button that opens `ExerciseTemplatePicker`
2. **Nutrition Plan section** - Shows `ClientNutritionPlanCard` if assigned, or "Assign Nutrition Plan" button that opens `NutritionTemplatePicker`

These load data from `/api/admin/client-exercise-plans?clientId=X` and `/api/admin/client-nutrition-plans?clientId=X` respectively.

---

## 8. Seed Data Strategy

**Approach:** Separate seed SQL file at `supabase/seed-exercises-foods.sql`. Run via Supabase SQL editor after migration.

**Why separate file, not inline in migration:**
- 100+ exercises and 80+ foods would make the migration file unmanageably long
- Seed data may need editing/re-running independently
- Keeps migration DDL clean and reviewable

### 8.1 Exercise Seed Data (120 exercises)

Organised by muscle group. Each row: `(name, muscle_group, equipment, description)`.

**Muscle groups and counts:**
- `chest` (12): Flat Bench Press, Incline Bench Press, Decline Bench Press, Dumbbell Flyes, Cable Crossovers, Push-Ups, Incline Dumbbell Press, Chest Dips, Pec Deck Machine, Floor Press, Landmine Press, Svend Press
- `back` (14): Barbell Rows, Lat Pulldown, Seated Cable Row, Pull-Ups, Chin-Ups, Single-Arm Dumbbell Row, T-Bar Row, Face Pulls, Straight-Arm Pulldown, Meadows Row, Pendlay Row, Chest-Supported Row, Inverted Row, Rack Pulls
- `shoulders` (12): Overhead Press, Lateral Raises, Front Raises, Rear Delt Flyes, Arnold Press, Upright Rows, Cable Lateral Raises, Dumbbell Shoulder Press, Plate Front Raise, Band Pull-Aparts, Z Press, Push Press
- `legs` (18): Back Squat, Front Squat, Romanian Deadlift, Leg Press, Leg Curl, Leg Extension, Bulgarian Split Squat, Goblet Squat, Lunges, Hip Thrust, Sumo Deadlift, Calf Raises, Hack Squat, Step-Ups, Glute Bridge, Nordic Curl, Wall Sit, Box Jumps
- `arms` (14): Barbell Curl, Dumbbell Curl, Hammer Curl, Preacher Curl, Tricep Pushdown, Skull Crushers, Overhead Tricep Extension, Close-Grip Bench Press, Concentration Curl, Cable Curl, Dips (Tricep), Diamond Push-Ups, Reverse Curl, Zottman Curl
- `core` (12): Plank, Dead Bug, Russian Twist, Cable Woodchop, Ab Rollout, Hanging Leg Raise, Bicycle Crunch, Pallof Press, Side Plank, Mountain Climbers, V-Ups, Flutter Kicks
- `cardio` (10): Treadmill Run, Rowing Machine, Assault Bike, Battle Ropes, Jumping Jacks, Burpees, Box Step-Ups, Sled Push, Farmer's Walk, Jump Rope
- `full_body` (10): Deadlift, Clean and Press, Thrusters, Turkish Get-Up, Kettlebell Swing, Man Maker, Bear Crawl, Snatch, Wall Balls, Devil Press
- `other` (8): Stretching, Foam Rolling, Mobility Work, Band Warm-Up, Yoga Flow, Breathing Drill, Cool Down Walk, Active Recovery

**Format of seed SQL:**
```sql
INSERT INTO exercises (name, muscle_group, equipment, description) VALUES
  ('Flat Bench Press', 'chest', 'barbell', 'Lie flat on bench, press barbell from chest to lockout'),
  ('Incline Bench Press', 'chest', 'barbell', 'Set bench to 30-45 degrees, press barbell from upper chest'),
  -- ... etc
;
```

### 8.2 Food Seed Data (90 foods)

Organised by category. Each row: `(name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g)`.

**Categories and counts:**
- `protein` (14): Chicken Breast, Turkey Mince, Salmon Fillet, Cod Fillet, Tuna (tinned), Lean Beef Mince, Steak (sirloin), Pork Loin, Prawns, Tofu, Tempeh, Whey Protein, Casein Protein, Eggs
- `dairy` (8): Whole Milk, Semi-Skimmed Milk, Greek Yoghurt, Cottage Cheese, Cheddar Cheese, Mozzarella, Feta Cheese, Skyr
- `grains` (10): White Rice, Brown Rice, Oats, Wholemeal Bread, White Pasta, Wholemeal Pasta, Sweet Potato, White Potato, Quinoa, Couscous
- `fruit` (8): Banana, Apple, Blueberries, Strawberries, Orange, Grapes, Mango, Avocado
- `vegetables` (10): Broccoli, Spinach, Green Beans, Peppers, Tomatoes, Carrots, Courgette, Mushrooms, Asparagus, Kale
- `fats` (8): Olive Oil, Coconut Oil, Peanut Butter, Almond Butter, Almonds, Walnuts, Chia Seeds, Flaxseed
- `carbs` (6): Bagel, Wraps (flour), Rice Cakes, Granola, Honey, Jam
- `snacks` (8): Protein Bar, Dark Chocolate (70%), Hummus, Popcorn (plain), Trail Mix, Rice Pudding, Cereal Bar, Beef Jerky
- `drinks` (6): Black Coffee, Green Tea, Coconut Water, Orange Juice, Smoothie (basic), Electrolyte Drink
- `supplements` (4): Creatine Monohydrate, BCAA Powder, Pre-Workout, Multivitamin
- `other` (8): Tomato Sauce, Soy Sauce, Hot Sauce, Balsamic Vinegar, Gravy, Stock Cube, Herbs/Spices, Coconut Milk

**Macro values should be based on UK nutritional data (per standard serving).** The executor should use realistic values. Example:
```sql
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
  ('Chicken Breast', 'protein', '150g', 231, 43.5, 0, 5.3, 0),
  ('Salmon Fillet', 'protein', '130g', 270, 26, 0, 18, 0),
  -- ... etc
;
```

---

## 9. Implementation Order

Each phase must be fully complete (including push to Vercel) before starting the next. All phases assume the bug fix (section 0) is done first.

### Phase 0: Bug Fix + Dependencies (15 min)
1. Create `app/api/admin/training-plans/route.ts` re-exporting from business-plans
2. Run `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities recharts`
3. Commit + push. Verify build passes on Vercel.

### Phase 1: Database Migration (30 min)
1. Run the full DDL SQL from section 2 via Supabase SQL Editor (all 16 tables)
2. Run the RLS SQL from section 3
3. Run the seed SQL from section 8 (exercises + foods)
4. Verify tables exist with `SELECT count(*) FROM exercises; SELECT count(*) FROM foods;`

### Phase 2: TypeScript Types (15 min)
Add to `lib/types.ts`:
```ts
// --- Exercise Plan Types ---
export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  description?: string;
  video_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface ExerciseSessionItem {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise?: Exercise;  // joined
  order_index: number;
  sets: number;
  reps: string;
  rest_seconds?: number;
  tempo?: string;
  notes?: string;
}

export interface ExerciseSession {
  id: string;
  template_id?: string;
  plan_id?: string;
  name: string;
  day_number: number;
  notes?: string;
  items: ExerciseSessionItem[];
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  duration_weeks?: number;
  is_active: boolean;
  sessions: ExerciseSession[];
  created_at: string;
  updated_at: string;
}

export interface ClientExercisePlan {
  id: string;
  client_id: string;
  template_id?: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  start_date?: string;
  end_date?: string;
  sessions: ExerciseSession[];
  created_at: string;
  updated_at: string;
}

// --- Nutrition Plan Types ---
export interface Food {
  id: string;
  name: string;
  category: string;
  serving_size: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g?: number;
  is_active: boolean;
  created_at: string;
}

export interface NutritionMealItem {
  id: string;
  meal_id: string;
  food_id: string;
  food?: Food;  // joined
  quantity: number;
  order_index: number;
  notes?: string;
}

export interface NutritionMeal {
  id: string;
  template_id?: string;
  plan_id?: string;
  name: string;
  order_index: number;
  notes?: string;
  items: NutritionMealItem[];
}

export interface NutritionTemplate {
  id: string;
  name: string;
  description?: string;
  calorie_range: string;
  target_calories?: number;
  target_protein_g?: number;
  target_carbs_g?: number;
  target_fat_g?: number;
  is_active: boolean;
  meals: NutritionMeal[];
  created_at: string;
  updated_at: string;
}

export interface ClientNutritionPlan {
  id: string;
  client_id: string;
  template_id?: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  target_calories?: number;
  target_protein_g?: number;
  target_carbs_g?: number;
  target_fat_g?: number;
  start_date?: string;
  meals: NutritionMeal[];
  created_at: string;
  updated_at: string;
}

export interface MealTracking {
  id: string;
  client_id: string;
  meal_id: string;
  tracked_date: string;
  completed: boolean;
}

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
```

### Phase 3: Exercise Library API + Admin Page (45 min)
1. Create `app/api/admin/exercises/route.ts` (GET, POST, PATCH, DELETE)
2. Create `components/admin/ExerciseLibraryTable.tsx`
3. Create `app/admin/exercise-library/page.tsx`
4. Test: can browse, search, filter, add, edit exercises

### Phase 4: Exercise Template Builder (60 min)
1. Create `components/ui/DndSortableList.tsx` (reusable)
2. Create `components/admin/ExercisePicker.tsx`
3. Create `components/admin/ExerciseTemplateBuilder.tsx`
4. Create `app/api/admin/exercise-templates/route.ts` (GET, POST, DELETE)
5. Create `app/admin/exercise-plans/page.tsx` (template list + builder)
6. Test: can create template with multiple sessions, drag-reorder, add exercises to sessions

### Phase 5: Client Exercise Plan Assignment (45 min)
1. Create `app/api/admin/client-exercise-plans/route.ts` (GET, POST, PATCH)
2. Create `components/admin/ExerciseTemplatePicker.tsx`
3. Create `components/admin/ClientExercisePlanCard.tsx`
4. Add exercise plan section to `app/admin/clients/[id]/page.tsx`
5. Test: can assign template to client, see it on client detail page

### Phase 6: Portal Exercise Plan View (30 min)
1. Create `app/api/portal/exercise-plan/route.ts`
2. Create `components/portal/ExercisePlan.tsx`
3. Create `app/portal/exercise-plan/page.tsx`
4. Test: client can see their assigned exercise plan

### Phase 7: Food Library API + Admin Page (45 min)
1. Create `app/api/admin/foods/route.ts` (GET, POST, PATCH, DELETE)
2. Create `components/admin/FoodLibraryTable.tsx`
3. Create `app/admin/food-library/page.tsx`
4. Test: can browse, search, filter, add, edit foods with macros

### Phase 8: Nutrition Template Builder (60 min)
1. Create `components/admin/FoodPicker.tsx`
2. Create `components/admin/MacroSummaryBar.tsx`
3. Create `components/admin/NutritionTemplateBuilder.tsx`
4. Create `app/api/admin/nutrition-templates/route.ts` (GET, POST, DELETE)
5. Create `app/admin/nutrition-plans/page.tsx` (template list + builder)
6. Test: can create nutrition template with meals, add foods, see live macro totals

### Phase 9: Client Nutrition Plan Assignment (45 min)
1. Create `app/api/admin/client-nutrition-plans/route.ts` (GET, POST, PATCH)
2. Create `components/admin/NutritionTemplatePicker.tsx`
3. Create `components/admin/ClientNutritionPlanCard.tsx`
4. Add nutrition plan section to `app/admin/clients/[id]/page.tsx`
5. Test: can assign nutrition template to client, see it on client detail page

### Phase 10: Portal Nutrition Plan View + Meal Tracking (45 min)
1. Create `app/api/portal/nutrition-plan/route.ts`
2. Create `app/api/portal/meal-tracking/route.ts`
3. Create `components/portal/MacroDonutChart.tsx`
4. Create `components/portal/MealTracker.tsx`
5. Create `components/portal/NutritionPlan.tsx`
6. Create `app/portal/nutrition-plan/page.tsx`
7. Test: client can see nutrition plan, macro chart, tick/untick meals

### Phase 11: Navigation Updates (30 min)
1. Update `components/admin/AdminSidebar.tsx` - add Exercise Plans + Nutrition Plans items
2. Update `components/portal/Sidebar.tsx` - add Exercise Plan + Nutrition items
3. Refactor `components/portal/MobileNav.tsx` - implement 5-item bar with "More" popup
4. Test: all navigation works on desktop + mobile

### Phase 12: Final Integration + Push (15 min)
1. Update portal dashboard (`app/portal/page.tsx`) - add exercise plan + nutrition plan summary cards
2. Commit all changes
3. Push to Vercel
4. Verify build passes
5. Test full flow: admin creates template -> assigns to client -> client sees it in portal

---

## 10. Design Tokens (Reference)

All new components must follow existing design language:

- **Card:** `bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl`
- **Active nav item:** `bg-[rgba(226,184,48,0.1)] text-accent-bright border border-[rgba(226,184,48,0.2)]`
- **Gold accent:** `#E2B830` (CSS var: `accent-bright`)
- **Font:** Inter (via `font-heading` and default)
- **Status badges:** Same `bg-X-500/10 text-X-400` pattern as existing status config
- **Buttons (primary):** `bg-accent-bright text-black font-semibold rounded-xl px-4 py-2`
- **Buttons (secondary):** `border border-[rgba(0,0,0,0.08)] text-text-secondary rounded-xl px-4 py-2`
- **Dark mode:** All colours must work with `.dark` class. Use CSS variables where they exist, or provide dark: variants.
- **Min font:** 13px site-wide (established rule)

---

## Appendix: Data Flow Diagrams

### Exercise Plan Flow
```
Admin creates Exercise Template
  -> Template stored in exercise_training_templates + sessions + items
Admin assigns template to Client
  -> Deep copy into client_exercise_plans + client_exercise_sessions + client_exercise_session_items
  -> Admin can then edit the client's copy independently
Client views their plan
  -> Portal reads from client_exercise_plans (joined with exercises for names)
```

### Nutrition Plan Flow
```
Admin creates Nutrition Template
  -> Template stored in nutrition_templates + meals + meal_items
Admin assigns template to Client
  -> Deep copy into client_nutrition_plans + client_nutrition_meals + client_nutrition_meal_items
  -> Macro targets copied from template (admin can override per-client)
Client views their plan + tracks meals
  -> Portal reads from client_nutrition_plans (joined with foods for macros)
  -> Client ticks meals in client_meal_tracking (one row per meal per day, upsert on toggle)
```
