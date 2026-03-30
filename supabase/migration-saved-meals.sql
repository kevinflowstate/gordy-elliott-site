CREATE TABLE saved_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_meals_read" ON saved_meals FOR SELECT TO authenticated USING (true);
