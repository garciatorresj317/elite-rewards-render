ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS points_per_dollar integer NOT NULL DEFAULT 1;

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_points_per_dollar_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_points_per_dollar_check
  CHECK (points_per_dollar BETWEEN 1 AND 1000);
