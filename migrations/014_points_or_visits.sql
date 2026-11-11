ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS loyalty_mode text NOT NULL DEFAULT 'points';

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_loyalty_mode_check;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_loyalty_mode_check
  CHECK (loyalty_mode IN ('points', 'visits'));

ALTER TABLE member_balances
  ADD COLUMN IF NOT EXISTS visits integer NOT NULL DEFAULT 0;
ALTER TABLE member_balances
  DROP CONSTRAINT IF EXISTS member_balances_visits_check;
ALTER TABLE member_balances
  ADD CONSTRAINT member_balances_visits_check CHECK (visits >= 0);

ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS visits_cost integer;
UPDATE rewards
   SET visits_cost = GREATEST(1, (points_cost + 99) / 100)
 WHERE visits_cost IS NULL;
ALTER TABLE rewards
  ALTER COLUMN visits_cost SET NOT NULL;
ALTER TABLE rewards
  DROP CONSTRAINT IF EXISTS rewards_visits_cost_check;
ALTER TABLE rewards
  ADD CONSTRAINT rewards_visits_cost_check CHECK (visits_cost > 0);

ALTER TABLE business_products
  ADD COLUMN IF NOT EXISTS visits_cost integer;
UPDATE business_products
   SET visits_cost = GREATEST(1, (points_cost + 99) / 100)
 WHERE visits_cost IS NULL AND points_cost IS NOT NULL;
ALTER TABLE business_products
  DROP CONSTRAINT IF EXISTS business_products_visits_cost_check;
ALTER TABLE business_products
  ADD CONSTRAINT business_products_visits_cost_check
  CHECK (visits_cost IS NULL OR (visits_cost >= 1 AND visits_cost <= 1000000));

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS visits_delta integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_mode text NOT NULL DEFAULT 'points';
ALTER TABLE ledger_entries
  ALTER COLUMN points_delta SET DEFAULT 0;
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_points_delta_check;
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_loyalty_mode_check;
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_loyalty_mode_check
  CHECK (loyalty_mode IN ('points', 'visits'));
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_loyalty_delta_check;
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_loyalty_delta_check
  CHECK (
    (loyalty_mode = 'points' AND points_delta <> 0 AND visits_delta = 0)
    OR
    (loyalty_mode = 'visits' AND visits_delta <> 0 AND points_delta = 0)
  );

ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS visits_cost_snapshot integer
  CHECK (visits_cost_snapshot IS NULL OR visits_cost_snapshot > 0);

CREATE INDEX IF NOT EXISTS businesses_loyalty_mode_idx ON businesses (loyalty_mode);
