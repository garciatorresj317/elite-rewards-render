ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#F6B900',
  ADD COLUMN IF NOT EXISTS secondary_color text NOT NULL DEFAULT '#FFE27A',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_primary_color_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_primary_color_check
  CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_secondary_color_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_secondary_color_check
  CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_logo_url_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_logo_url_check
  CHECK (logo_url IS NULL OR (char_length(logo_url) <= 2048 AND logo_url ~ '^https://'));

CREATE TABLE IF NOT EXISTS platform_administrator (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve the already established platform authority by immutable user ID and fail closed
-- if production contains an ambiguous platform-administrator state.
DO $$
DECLARE
  platform_business text;
  authority_count integer;
  authority_id text;
BEGIN
  SELECT business_id INTO platform_business FROM platform_state WHERE singleton = true;
  SELECT count(*), min(id)
    INTO authority_count, authority_id
    FROM users
   WHERE platform_admin = true
     AND business_id = platform_business
     AND role = 'owner'
     AND active = true;
  IF authority_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one active platform owner authority, found %', authority_count;
  END IF;
  INSERT INTO platform_administrator(singleton,user_id)
  VALUES (true, authority_id)
  ON CONFLICT (singleton) DO UPDATE SET user_id = EXCLUDED.user_id;
END $$;

-- The original setup business is the Elite Rewards platform tenant, not a sellable client.
UPDATE users
   SET platform_admin = (id = (SELECT user_id FROM platform_administrator WHERE singleton = true));

CREATE UNIQUE INDEX IF NOT EXISTS users_single_platform_admin_idx
  ON users (platform_admin)
  WHERE platform_admin = true;
