CREATE TABLE IF NOT EXISTS contract_payments (
  id text PRIMARY KEY,
  service_contract_id text REFERENCES service_contracts(id) ON DELETE RESTRICT,
  linked_business_id text REFERENCES businesses(id) ON DELETE RESTRICT,
  client_name text NOT NULL CHECK (char_length(client_name) BETWEEN 2 AND 160),
  description text NOT NULL CHECK (char_length(description) BETWEEN 2 AND 240),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0 AND amount_cents <= 100000000),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'due', 'paid', 'void')),
  paid_at timestamptz,
  payment_method text NOT NULL DEFAULT '' CHECK (char_length(payment_method) <= 80),
  reference text NOT NULL DEFAULT '' CHECK (char_length(reference) <= 160),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'paid' AND paid_at IS NOT NULL) OR (status <> 'paid' AND paid_at IS NULL))
);

CREATE INDEX IF NOT EXISTS contract_payments_due_idx
  ON contract_payments (due_date, status);
CREATE INDEX IF NOT EXISTS contract_payments_contract_idx
  ON contract_payments (service_contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contract_payments_business_idx
  ON contract_payments (linked_business_id, created_at DESC);
