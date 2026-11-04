ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_admin boolean NOT NULL DEFAULT false;

UPDATE users
   SET platform_admin = true
 WHERE role = 'owner'
   AND business_id = (
     SELECT business_id
       FROM platform_state
      WHERE singleton = true
   );

CREATE TABLE IF NOT EXISTS client_invitations (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id text NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  owner_name text NOT NULL CHECK (char_length(owner_name) BETWEEN 2 AND 120),
  owner_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_invitations_business_idx
  ON client_invitations (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS client_invitations_email_idx
  ON client_invitations (lower(owner_email));
