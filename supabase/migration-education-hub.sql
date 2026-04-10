-- Education Hub: Seed modules, lessons, and Values Determination results table
-- Run in Supabase Dashboard SQL Editor

-- ============================================
-- SCHEMA CHANGES
-- ============================================

-- Add slug column for referencing modules in code
ALTER TABLE public.training_modules ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Add 'interactive' content type
ALTER TABLE public.module_content DROP CONSTRAINT IF EXISTS module_content_content_type_check;
ALTER TABLE public.module_content ADD CONSTRAINT module_content_content_type_check
  CHECK (content_type IN ('video', 'pdf', 'text', 'checklist', 'interactive'));

-- Values Determination results table
CREATE TABLE IF NOT EXISTS public.values_determination_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  values_hierarchy JSONB NOT NULL DEFAULT '[]',
  alignment_score INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_values_results_client_id ON public.values_determination_results(client_id);

ALTER TABLE public.values_determination_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can manage own values results" ON public.values_determination_results
  FOR ALL USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all values results" ON public.values_determination_results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- SEED MODULES
-- ============================================

INSERT INTO public.training_modules (title, description, order_index, slug, is_published) VALUES
  ('Your Personal X-RAY', 'Week 1 — Who are you really? Before we train your body, we need to understand your mind. This is where the real work starts.', 1, 'personal-xray', true),
  ('Values Determination', 'Discover what actually drives you. An interactive tool adapted from Dr John Demartini''s methodology, written in the SHIFT coaching voice.', 2, 'values-determination', true),
  ('Clarity on Basics', 'Week 2 — The foundations. Training structure, nutrition basics, and breaking the cycle of self-sabotage.', 3, 'clarity-basics', true),
  ('Nutrition Deep Dive', 'Week 3 — Protein, carbs, fats, and how to actually use MyFitnessPal the right way.', 4, 'nutrition-deep-dive', true),
  ('Building Habits', 'Week 4 — The habit loop, sleep, and why being a Week-1 hero will set you back.', 5, 'building-habits', true),
  ('Stress Management', 'Week 6 — Stress, breathwork, cortisol, and why you can''t lose weight when you''re wired.', 6, 'stress-management', true),
  ('Mental Resilience', 'Week 7 — The most powerful module. Four Pillars, life cycles, and prior planning.', 7, 'mental-resilience', true),
  ('Supplementary Lessons', 'Extra resources — food labels, fibre, sleep hygiene, hormones, mobility, and more. Dip in when you need them.', 8, 'supplementary', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- SEED LESSONS
-- ============================================

-- Week 1: Your Personal X-RAY
DO $$
DECLARE mod_id UUID;
BEGIN
  SELECT id INTO mod_id FROM public.training_modules WHERE slug = 'personal-xray';
  IF mod_id IS NOT NULL THEN
    INSERT INTO public.module_content (module_id, title, content_type, content_url, content_text, order_index, duration_minutes) VALUES
      (mod_id, 'Welcome to SHIFT', 'video', 'https://www.loom.com/share/739bb08056654e09822aac378aeac858', 'This is the starting line. Not a gym induction — a life audit. We set the engagement rules, how deep check-ins work, and what you can expect from the programme. Watch this first.', 1, 10),
      (mod_id, 'Get to Grips With the App', 'video', 'https://www.loom.com/share/a05e77579927419e8efc602f0d365ad6', 'If this was an app to buy clothes, book flights, or order food — you''d already have it mastered. Treat this the same way. Kahunas is your daily habit tracker. 1 minute a day. No excuses.', 2, 8),
      (mod_id, 'Values Determination', 'interactive', '/portal/values-determination', 'Complete the interactive Values Determination exercise. Based on Dr John Demartini''s methodology, rewritten in the SHIFT coaching voice. This reveals what actually drives you — not what you think drives you.', 3, 20),
      (mod_id, 'Write a Letter to Yourself', 'video', 'https://www.loom.com/share/b008195203d648faa1d9dad324d10e97', 'Journaling and emotional unpacking. Write a letter to your future self. Set it to send back in 3-4 weeks via futureme.org. This is how we close Week 1 strong.', 4, 12),
      (mod_id, 'Check-In Format', 'video', 'https://www.loom.com/share/3c0929833155434d9bfdb46f2838d797', 'How the SHIFT check-in cycle works. This is not a weigh-in. It''s a full debrief — what held, what didn''t, what''s next. Learn the format so you get the most out of every session.', 5, 8);
  END IF;
END $$;

-- Values Determination module (interactive — no traditional lessons, handled by the app)
DO $$
DECLARE mod_id UUID;
BEGIN
  SELECT id INTO mod_id FROM public.training_modules WHERE slug = 'values-determination';
  IF mod_id IS NOT NULL THEN
    INSERT INTO public.module_content (module_id, title, content_type, content_url, content_text, order_index, duration_minutes) VALUES
      (mod_id, 'Values Determination Intro', 'video', 'https://www.loom.com/share/43a07b5e79594ab4bbed168fc4493177', 'Watch this first. Gordy explains the DeMartini values process and why it matters before you start the interactive exercise.', 1, 10),
      (mod_id, 'Complete the Exercise', 'interactive', '/portal/values-determination', '13 evidence-based questions. 3 answers each. The tool cross-references your 39 answers to find what actually drives you — not what you think should drive you. Takes about 15-20 minutes.', 2, 20),
      (mod_id, 'DeMartini Reference', 'text', NULL, 'The original Dr John Demartini Values Determination process: https://drdemartini.com/values/', 3, 5);
  END IF;
END $$;

-- Week 2: Clarity on Basics
DO $$
DECLARE mod_id UUID;
BEGIN
  SELECT id INTO mod_id FROM public.training_modules WHERE slug = 'clarity-basics';
  IF mod_id IS NOT NULL THEN
    INSERT INTO public.module_content (module_id, title, content_type, content_url, content_text, order_index, duration_minutes) VALUES
      (mod_id, 'Training Structure', 'video', NULL, 'How your training plan is structured and why. Understanding the method behind the programme.', 1, 10),
      (mod_id, 'Nutrition / The Fridge Method', 'text', NULL, 'The Battle Books and Fridge Method. Open your fridge, list what''s in there, build meals from it. 20-30 minutes. This is the excuse killer — no meal prep required, no shopping list, no ''I don''t know what to eat.''', 2, 15),
      (mod_id, 'Breaking the Cycle', 'video', 'https://www.youtube.com/watch?v=HTSQ8gn63yk', 'The self-sabotage loop: Start > Progress > Sacrifice > Boredom > The Pit > Restart. Sound familiar? Evolution step: fix ONE problem at a time. This is the framework to revisit every time you feel yourself slipping.', 3, 12),
      (mod_id, 'Strength-Physique-Fitness Triangle', 'video', 'https://www.loom.com/share/d325c63fde5f4c4ebb17e18024070c13', 'Where are you leaning on this triangle right now? Is it aligned with your actual goal? Most people chase fitness when they need strength. Or chase physique when their fundamentals aren''t in place.', 4, 10),
      (mod_id, 'Plan Terminology', 'text', NULL, 'Training cheat sheet. Sets, reps, tempo, RPE, rest periods — what they mean and why they matter. Keep this as a reference.', 5, 5);
  END IF;
END $$;

-- Week 3: Nutrition Deep Dive
DO $$
DECLARE mod_id UUID;
BEGIN
  SELECT id INTO mod_id FROM public.training_modules WHERE slug = 'nutrition-deep-dive';
  IF mod_id IS NOT NULL THEN
    INSERT INTO public.module_content (module_id, title, content_type, content_url, content_text, order_index, duration_minutes) VALUES
      (mod_id, 'Protein', 'video', 'https://www.loom.com/share/4559ee15162f4aae9b54159d4562e862', 'Macros explained. Why protein matters, how much you need, and where to get it. This is the foundation of your nutrition plan.', 1, 12),
      (mod_id, 'Carbohydrates', 'video', 'https://www.loom.com/share/9457acd01e4b4cffb63ec56f92f0369f', 'Carbs get demonised more than any other nutrient. But they''re not the enemy — they''re your body''s preferred energy source. Look at your current food log: are your carbs coming more from whole foods or refined sugars? Shift the balance this week.', 2, 12),
      (mod_id, 'Fats', 'video', 'https://www.loom.com/share/57b7914c680f49df96ea6997dbc00d95', 'Often misunderstood and labeled ''bad,'' but fats are crucial for your health and performance. Which one healthy fat can you lean into more this week?', 3, 10),
      (mod_id, 'Using MyFitnessPal the Right Way', 'video', 'https://www.loom.com/share/8c628c9e351a472fac30c6e65c7cf149', 'Not just a ''weight loss app.'' MFP is a tool for nutrition awareness. This week, log everything for 3 days straight — including snacks and drinks — then review how it matches your goals. The aim is long-term awareness, not permanent tracking.', 4, 10),
      (mod_id, 'Calories vs Macros', 'video', 'https://www.loom.com/share/a13ddbfb8a1f458e857994dbc89d0217', 'Most people follow influencers or slimming clubs that push calories only. Here''s the truth: don''t just chase calories. Hit your macro targets — that''s how you lose fat, protect muscle, and build confidence long term.', 5, 10);
  END IF;
END $$;

-- Week 4: Building Habits
DO $$
DECLARE mod_id UUID;
BEGIN
  SELECT id INTO mod_id FROM public.training_modules WHERE slug = 'building-habits';
  IF mod_id IS NOT NULL THEN
    INSERT INTO public.module_content (module_id, title, content_type, content_url, content_text, order_index, duration_minutes) VALUES
      (mod_id, 'The Habit Loop', 'video', NULL, 'How habits actually form and how to use that knowledge. Includes homework to identify your current loops and design better ones.', 1, 12),
      (mod_id, 'Example Habits', 'text', NULL, 'Trigger > Routine > Reward. That''s the loop. Here are examples:\n\n- Morning mindset check: alarm goes off > 5 min journaling > coffee reward\n- Post-work training: leave office > gym bag in car > train > favourite podcast on the drive home\n- Evening wind-down: dinner done > phone on charge in another room > read for 20 min\n\nUse this when motivation drops. You don''t need motivation — you need a loop.', 2, 8),
      (mod_id, 'Sleep Done Right', 'video', NULL, 'Sleep is the most underrated performance enhancer. This lesson covers what actually matters for sleep quality — not just duration.', 3, 10),
      (mod_id, 'Don''t Be a Week-1 Hero', 'video', NULL, 'You know the type. Goes all in on day one, burns out by day ten. This video is the antidote. Slow is fast. Consistency beats intensity every time.', 4, 8);
  END IF;
END $$;

-- Week 6: Stress Management
DO $$
DECLARE mod_id UUID;
BEGIN
  SELECT id INTO mod_id FROM public.training_modules WHERE slug = 'stress-management';
  IF mod_id IS NOT NULL THEN
    INSERT INTO public.module_content (module_id, title, content_type, content_url, content_text, order_index, duration_minutes) VALUES
      (mod_id, 'Stress Lesson', 'video', NULL, 'Understanding stress — what it actually is, what it does to your body, and why managing it is non-negotiable for your results.', 1, 12),
      (mod_id, 'Breathwork by Sandy', 'video', NULL, 'Guided breathwork session. Use this when stress is building or as a daily practice.', 2, 15),
      (mod_id, 'Box Breathing', 'text', NULL, 'Navy SEALs method. Simple. Effective. Use in acute stress:\n\n1. Inhale for 4 seconds\n2. Hold for 4 seconds\n3. Exhale for 4 seconds\n4. Hold for 4 seconds\n\nRepeat for 5 minutes. That''s it. This resets your nervous system. Do it before a difficult conversation, before sleep, or any time you feel the pressure building.', 3, 5),
      (mod_id, '4-7-8 Technique', 'video', NULL, 'Another breathing technique for calming the nervous system. Especially effective before sleep.', 4, 8),
      (mod_id, 'Stress, Cortisol & Fat Loss', 'video', NULL, 'Doing everything right but can''t lose weight? This might be why. Cortisol — the stress hormone — directly impacts fat storage, especially around the midsection. This lesson connects the dots between stress and stubborn fat.', 5, 12);
  END IF;
END $$;

-- Week 7: Mental Resilience
DO $$
DECLARE mod_id UUID;
BEGIN
  SELECT id INTO mod_id FROM public.training_modules WHERE slug = 'mental-resilience';
  IF mod_id IS NOT NULL THEN
    INSERT INTO public.module_content (module_id, title, content_type, content_url, content_text, order_index, duration_minutes) VALUES
      (mod_id, 'Prior Planning > Better Performance', 'text', NULL, 'The 7Ps — an Army rule that applies to everything:\n\nPrior Planning and Preparation Prevents Piss Poor Performance.\n\nIf you walk into a week without a plan, you''re planning to fail. This isn''t about being rigid — it''s about having a framework so when life throws curveballs, you can adapt instead of collapse.', 1, 8),
      (mod_id, 'Life Cycles', 'text', NULL, 'Understanding where you are in the cycle. Not every week will be a breakthrough week. Some weeks are about holding the line. Recognising the pattern stops you from quitting when you''re actually exactly where you should be.', 2, 10),
      (mod_id, 'What People Think They Need vs What Actually Works', 'text', NULL, 'Most coaches start with nutrition and training. That''s backwards. Here''s the actual order:\n\n1. WHY — Values, purpose, identity\n2. Trauma — What shaped you, what patterns are running\n3. Current — Where you actually are (not where you think you are)\n4. Support — Who surrounds you\n5. Calories — Only then do we talk numbers\n\nSkipping to step 5 is why most programmes fail. SHIFT doesn''t skip.', 3, 10),
      (mod_id, 'The Four Pillars', 'text', NULL, 'The SHIFT framework for everything:\n\n1. YOU — Identity, values, purpose\n2. NUTRITION — Fuel, not punishment\n3. MOVEMENT — Training with intent\n4. REST — Recovery, sleep, deload\n\nIn that order. Most coaches start at 3. We start at 1. If Pillar 1 isn''t solid, pillars 2-4 will always crumble.\n\nRevisit this when you keep restarting or can''t see progress. The answer is almost always in Pillar 1.', 4, 10);
  END IF;
END $$;

-- Supplementary Lessons
DO $$
DECLARE mod_id UUID;
BEGIN
  SELECT id INTO mod_id FROM public.training_modules WHERE slug = 'supplementary';
  IF mod_id IS NOT NULL THEN
    INSERT INTO public.module_content (module_id, title, content_type, content_url, content_text, order_index, duration_minutes) VALUES
      (mod_id, 'Read Food Labels Like a Pro', 'text', NULL, 'Stop guessing. Learn to read the back of the packet — not the front. The front is marketing. The back is truth.', 1, 8),
      (mod_id, 'The Third Pillar / Fibre', 'text', NULL, 'Fibre — the nutrient nobody talks about but everyone needs more of. Gut health, digestion, satiety. This is the missing piece for most people.', 2, 8),
      (mod_id, 'Stop Building On Sand', 'text', NULL, 'You can''t build a solid structure on a weak foundation. If your basics aren''t locked in, adding more complexity won''t help — it''ll make things worse.', 3, 8),
      (mod_id, 'Sleep Hygiene Protocol', 'text', NULL, 'A practical protocol for better sleep. Environment, routine, timing, and the habits that actually move the needle.', 4, 10),
      (mod_id, 'The New US Food Pyramid', 'text', NULL, 'The old food pyramid was wrong. Here''s what the evidence actually supports for balanced nutrition.', 5, 8),
      (mod_id, 'The 7 Questions Framework', 'text', NULL, 'Demartini''s 7 Questions applied to coaching. Use this alongside the Values Determination for deeper self-awareness.', 6, 10),
      (mod_id, 'Vitamin D — Don''t Miss Out', 'text', NULL, 'Fatigue? Low mood? Can''t recover? Check your Vitamin D. Especially in the UK and Ireland, this is the supplement that makes the biggest difference.', 7, 5),
      (mod_id, 'The Dopamine Trap', 'text', NULL, 'Exhausted despite sleeping? Tired all day but wired at night? You might be caught in the dopamine trap. This lesson explains why and how to break it.', 8, 8),
      (mod_id, 'Hormones', 'text', NULL, 'Periods, menopause, testosterone — how hormones affect training, nutrition, recovery, and mood. What to watch for and how to work with your body, not against it.', 9, 10),
      (mod_id, 'Meal Systems: Calorie Setup', 'text', NULL, 'How to set up your calorie targets based on your goals, activity level, and current starting point.', 10, 10),
      (mod_id, 'Mobility by Stevie', 'video', NULL, 'Movement restrictions holding you back? Stevie walks through mobility work to unlock tight areas and improve your training quality.', 11, 15),
      (mod_id, 'Accelerator', 'text', NULL, 'For advanced clients ready to push further. This content opens up once you''ve mastered the fundamentals.', 12, 10);
  END IF;
END $$;
