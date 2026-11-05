ALTER TABLE business_visual_settings
  ADD COLUMN IF NOT EXISTS automatic_holiday_themes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'UTC';

ALTER TABLE business_visual_settings
  DROP CONSTRAINT IF EXISTS business_visual_settings_time_zone_length_check;

ALTER TABLE business_visual_settings
  ADD CONSTRAINT business_visual_settings_time_zone_length_check
  CHECK (char_length(time_zone) BETWEEN 1 AND 100);
