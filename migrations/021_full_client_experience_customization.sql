ALTER TABLE business_visual_settings
  DROP CONSTRAINT IF EXISTS business_visual_settings_theme_key_check;

ALTER TABLE business_visual_settings
  ADD CONSTRAINT business_visual_settings_theme_key_check
  CHECK (theme_key IN (
    'elite-signature', 'mlk-day', 'remembrance-911', 'winter-holiday',
    'spring-celebration', 'community-event', 'cosmic-neon', 'royal-purple',
    'ocean-glow', 'sunset-energy'
  ));

ALTER TABLE business_visual_settings
  ADD COLUMN IF NOT EXISTS company_slogan text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_slogan_es text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS public_headline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS public_headline_es text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS public_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS public_message_es text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS join_headline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS join_headline_es text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS join_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS join_message_es text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS member_headline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS member_headline_es text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS member_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS member_message_es text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#F6B900',
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#14E6FF',
  ADD COLUMN IF NOT EXISTS background_color text NOT NULL DEFAULT '#020713',
  ADD COLUMN IF NOT EXISTS surface_color text NOT NULL DEFAULT '#07111F',
  ADD COLUMN IF NOT EXISTS text_color text NOT NULL DEFAULT '#FFFAF0',
  ADD COLUMN IF NOT EXISTS muted_color text NOT NULL DEFAULT '#C7BEA8',
  ADD COLUMN IF NOT EXISTS font_style text NOT NULL DEFAULT 'futuristic',
  ADD COLUMN IF NOT EXISTS corner_style text NOT NULL DEFAULT 'soft',
  ADD COLUMN IF NOT EXISTS show_rewards boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_products boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_referrals boolean NOT NULL DEFAULT true;

ALTER TABLE business_visual_settings
  DROP CONSTRAINT IF EXISTS business_visual_settings_company_slogan_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_company_slogan_es_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_public_headline_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_public_headline_es_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_public_message_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_public_message_es_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_join_headline_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_join_headline_es_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_join_message_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_join_message_es_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_member_headline_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_member_headline_es_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_member_message_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_member_message_es_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_primary_color_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_accent_color_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_background_color_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_surface_color_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_text_color_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_muted_color_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_font_style_check,
  DROP CONSTRAINT IF EXISTS business_visual_settings_corner_style_check;

ALTER TABLE business_visual_settings
  ADD CONSTRAINT business_visual_settings_company_slogan_check CHECK (char_length(company_slogan) <= 120),
  ADD CONSTRAINT business_visual_settings_company_slogan_es_check CHECK (char_length(company_slogan_es) <= 120),
  ADD CONSTRAINT business_visual_settings_public_headline_check CHECK (char_length(public_headline) <= 120),
  ADD CONSTRAINT business_visual_settings_public_message_check CHECK (char_length(public_message) <= 300),
  ADD CONSTRAINT business_visual_settings_join_headline_check CHECK (char_length(join_headline) <= 120),
  ADD CONSTRAINT business_visual_settings_join_message_check CHECK (char_length(join_message) <= 300),
  ADD CONSTRAINT business_visual_settings_member_headline_check CHECK (char_length(member_headline) <= 120),
  ADD CONSTRAINT business_visual_settings_member_message_check CHECK (char_length(member_message) <= 300),
  ADD CONSTRAINT business_visual_settings_public_headline_es_check CHECK (char_length(public_headline_es) <= 120),
  ADD CONSTRAINT business_visual_settings_public_message_es_check CHECK (char_length(public_message_es) <= 300),
  ADD CONSTRAINT business_visual_settings_join_headline_es_check CHECK (char_length(join_headline_es) <= 120),
  ADD CONSTRAINT business_visual_settings_join_message_es_check CHECK (char_length(join_message_es) <= 300),
  ADD CONSTRAINT business_visual_settings_member_headline_es_check CHECK (char_length(member_headline_es) <= 120),
  ADD CONSTRAINT business_visual_settings_member_message_es_check CHECK (char_length(member_message_es) <= 300),
  ADD CONSTRAINT business_visual_settings_primary_color_check CHECK (char_length(primary_color) = 7),
  ADD CONSTRAINT business_visual_settings_accent_color_check CHECK (char_length(accent_color) = 7),
  ADD CONSTRAINT business_visual_settings_background_color_check CHECK (char_length(background_color) = 7),
  ADD CONSTRAINT business_visual_settings_surface_color_check CHECK (char_length(surface_color) = 7),
  ADD CONSTRAINT business_visual_settings_text_color_check CHECK (char_length(text_color) = 7),
  ADD CONSTRAINT business_visual_settings_muted_color_check CHECK (char_length(muted_color) = 7),
  ADD CONSTRAINT business_visual_settings_font_style_check CHECK (font_style IN ('futuristic', 'modern', 'classic')),
  ADD CONSTRAINT business_visual_settings_corner_style_check CHECK (corner_style IN ('sharp', 'soft', 'rounded'));
