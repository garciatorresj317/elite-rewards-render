ALTER TABLE business_visual_settings
  DROP CONSTRAINT IF EXISTS business_visual_settings_theme_key_check;

ALTER TABLE business_visual_settings
  ADD CONSTRAINT business_visual_settings_theme_key_check
  CHECK (theme_key IN (
    'elite-signature', 'mlk-day', 'remembrance-911', 'winter-holiday',
    'spring-celebration', 'community-event', 'cosmic-neon', 'royal-purple',
    'ocean-glow', 'sunset-energy', 'emerald-pulse', 'ruby-velocity',
    'arctic-prism', 'golden-horizon'
  ));