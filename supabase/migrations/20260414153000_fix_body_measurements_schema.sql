-- Align progress-tracking fields with the portal UI and API.
-- Older environments may still have the original `hip_cm` column but not the
-- newer limb measurement fields expected by the client portal.

ALTER TABLE public.client_body_measurements
  ADD COLUMN IF NOT EXISTS hips_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS left_arm_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS right_arm_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS left_thigh_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS right_thigh_cm NUMERIC(5,1);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_body_measurements'
      AND column_name = 'hip_cm'
  ) THEN
    EXECUTE '
      UPDATE public.client_body_measurements
      SET hips_cm = COALESCE(hips_cm, hip_cm)
      WHERE hip_cm IS NOT NULL
    ';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_body_measurements_unique_day
  ON public.client_body_measurements(client_id, measured_date);
