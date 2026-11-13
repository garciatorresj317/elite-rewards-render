CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS businesses (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  loyalty_mode text NOT NULL DEFAULT 'points' CHECK (loyalty_mode IN ('points', 'visits')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  business_id text NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id text REFERENCES locations(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('owner', 'staff', 'member')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  email text NOT NULL,
  password_hash text NOT NULL,
  member_code text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, email)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_global_email_unique_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS rewards (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  points_cost integer NOT NULL CONSTRAINT rewards_points_cost_check CHECK (points_cost > 0),
  visits_cost integer NOT NULL DEFAULT 1 CONSTRAINT rewards_visits_cost_check CHECK (visits_cost > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_balances (
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  member_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  visits integer NOT NULL DEFAULT 0 CHECK (visits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, member_id)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id text REFERENCES locations(id) ON DELETE RESTRICT,
  member_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entry_type text NOT NULL CHECK (entry_type IN ('earn', 'redeem', 'adjustment', 'reversal')),
  points_delta integer NOT NULL DEFAULT 0,
  visits_delta integer NOT NULL DEFAULT 0,
  loyalty_mode text NOT NULL DEFAULT 'points' CHECK (loyalty_mode IN ('points', 'visits')),
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  reward_id text REFERENCES rewards(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_entries_check CHECK (
    (loyalty_mode = 'points' AND points_delta <> 0 AND visits_delta = 0)
    OR (loyalty_mode = 'visits' AND visits_delta <> 0 AND points_delta = 0)
  ),
  UNIQUE (business_id, actor_user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS ledger_member_created_idx ON ledger_entries (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_business_created_idx ON ledger_entries (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_records (
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  actor_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('award', 'redeem')),
  request_digest text NOT NULL,
  result_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, actor_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS redemptions (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  member_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reward_id text NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  ledger_entry_id text NOT NULL UNIQUE REFERENCES ledger_entries(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'void')),
  code text NOT NULL UNIQUE,
  visits_cost_snapshot integer CONSTRAINT redemptions_visits_cost_snapshot_check
    CHECK (visits_cost_snapshot IS NULL OR visits_cost_snapshot > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS redemptions_member_created_idx ON redemptions (member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_business_created_idx ON audit_events (business_id, created_at DESC);
