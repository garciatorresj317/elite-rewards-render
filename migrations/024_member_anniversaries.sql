ALTER TABLE users
  ADD CONSTRAINT users_id_business_unique UNIQUE (id, business_id);

CREATE TABLE IF NOT EXISTS member_anniversary_gifts (
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  member_id text NOT NULL,
  milestone_years integer NOT NULL CHECK (milestone_years BETWEEN 1 AND 200),
  status text NOT NULL CHECK (status IN ('planned', 'sent')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
  planned_at timestamptz,
  sent_at timestamptz,
  updated_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, member_id, milestone_years),
  FOREIGN KEY (member_id, business_id) REFERENCES users(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by_user_id, business_id) REFERENCES users(id, business_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS member_anniversary_gifts_business_updated_idx
  ON member_anniversary_gifts (business_id, updated_at DESC);
