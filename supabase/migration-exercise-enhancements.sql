-- Add section labels and superset groups to exercise session items
ALTER TABLE exercise_training_session_items ADD COLUMN section_label text;
ALTER TABLE exercise_training_session_items ADD COLUMN superset_group text;
ALTER TABLE client_exercise_session_items ADD COLUMN section_label text;
ALTER TABLE client_exercise_session_items ADD COLUMN superset_group text;
