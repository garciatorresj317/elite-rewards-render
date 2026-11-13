CREATE TABLE IF NOT EXISTS member_referral_links (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id text NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  member_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_referral_links_business_idx
  ON member_referral_links (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS member_referrals (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  referrer_member_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  referred_member_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  referral_link_id text NOT NULL REFERENCES member_referral_links(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'qualified', 'rewarded', 'void')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_referrals_referrer_idx
  ON member_referrals (business_id, referrer_member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS request_rate_limits (
  scope text NOT NULL,
  subject_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts >= 0),
  PRIMARY KEY (scope, subject_hash, window_start)
);
CREATE INDEX IF NOT EXISTS request_rate_limits_window_idx
  ON request_rate_limits (window_start);

CREATE TABLE IF NOT EXISTS business_visual_settings (
  business_id text PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  theme_key text NOT NULL DEFAULT 'elite-signature' CONSTRAINT business_visual_settings_theme_key_check CHECK (theme_key IN ('elite-signature', 'mlk-day', 'remembrance-911', 'winter-holiday', 'spring-celebration', 'community-event', 'cosmic-neon', 'royal-purple', 'ocean-glow', 'sunset-energy')),
  occasion_title text NOT NULL DEFAULT '' CHECK (char_length(occasion_title) <= 80),
  occasion_message text NOT NULL DEFAULT '' CHECK (char_length(occasion_message) <= 220),
  updated_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO business_visual_settings(business_id)
SELECT id FROM businesses
ON CONFLICT (business_id) DO NOTHING;
