ALTER TABLE business_visual_settings
  ADD COLUMN IF NOT EXISTS palette_source text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS logo_palette_version integer NOT NULL DEFAULT 0;

ALTER TABLE business_visual_settings
  DROP CONSTRAINT IF EXISTS business_visual_settings_palette_source_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_logo_palette_version_check;

ALTER TABLE business_visual_settings
  ADD CONSTRAINT business_visual_settings_palette_source_check
    CHECK (palette_source IN ('default', 'logo', 'manual')),
  ADD CONSTRAINT business_visual_settings_logo_palette_version_check
    CHECK (logo_palette_version >= 0);