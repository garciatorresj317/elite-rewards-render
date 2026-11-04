CREATE TABLE IF NOT EXISTS member_invitations (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id text NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  member_name text NOT NULL CHECK (char_length(member_name) BETWEEN 2 AND 120),
  member_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_invitations_business_idx
  ON member_invitations (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS member_invitations_email_idx
  ON member_invitations (lower(member_email));
CREATE UNIQUE INDEX IF NOT EXISTS member_invitations_pending_email_unique_idx
  ON member_invitations (lower(member_email))
  WHERE accepted_at IS NULL;
