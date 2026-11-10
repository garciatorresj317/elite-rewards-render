CREATE TABLE IF NOT EXISTS password_reset_requests (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'used', 'cancelled', 'expired')),
  subject_hash text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  issued_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  issued_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS password_reset_requests_business_idx
  ON password_reset_requests (business_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_requests_user_idx
  ON password_reset_requests (user_id, requested_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_requests_pending_user_idx
  ON password_reset_requests (user_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE REFERENCES password_reset_requests(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry_idx
  ON password_reset_tokens (expires_at);
