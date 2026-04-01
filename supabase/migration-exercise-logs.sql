CREATE TABLE IF NOT EXISTS client_exercise_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exercise_item_id uuid NOT NULL,
  session_id uuid,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  sets_data jsonb DEFAULT '[]'::jsonb,
  completed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, exercise_item_id, log_date)
);

ALTER TABLE client_exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exercise logs" ON client_exercise_logs
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Users can insert own exercise logs" ON client_exercise_logs
  FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update own exercise logs" ON client_exercise_logs
  FOR UPDATE USING (client_id = auth.uid());

CREATE POLICY "Admins can view all exercise logs" ON client_exercise_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE INDEX idx_exercise_logs_client_date ON client_exercise_logs(client_id, log_date);
CREATE INDEX idx_exercise_logs_item ON client_exercise_logs(exercise_item_id);
