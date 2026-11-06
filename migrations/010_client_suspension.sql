ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_version bigint NOT NULL DEFAULT 1;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS business_access_version bigint NOT NULL DEFAULT 1;

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_suspension_state_check;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_suspension_state_check CHECK (
    (active = true AND suspended_at IS NULL AND suspended_by_user_id IS NULL)
    OR
    (active = false AND suspended_at IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS businesses_active_idx ON businesses (active);
