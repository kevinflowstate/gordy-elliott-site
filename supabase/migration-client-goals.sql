ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS primary_goal text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS target_date date;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS goal_notes text;
