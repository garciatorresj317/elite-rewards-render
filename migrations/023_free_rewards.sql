ALTER TABLE rewards
  DROP CONSTRAINT IF EXISTS rewards_points_cost_check;
ALTER TABLE rewards
  ADD CONSTRAINT rewards_points_cost_check
  CHECK (points_cost >= 0);

ALTER TABLE rewards
  DROP CONSTRAINT IF EXISTS rewards_visits_cost_check;
ALTER TABLE rewards
  ADD CONSTRAINT rewards_visits_cost_check
  CHECK (visits_cost >= 0);

ALTER TABLE redemptions
  DROP CONSTRAINT IF EXISTS redemptions_points_cost_snapshot_check;
ALTER TABLE redemptions
  ADD CONSTRAINT redemptions_points_cost_snapshot_check
  CHECK (points_cost_snapshot IS NULL OR points_cost_snapshot >= 0);

ALTER TABLE redemptions
  DROP CONSTRAINT IF EXISTS redemptions_visits_cost_snapshot_check;
ALTER TABLE redemptions
  ADD CONSTRAINT redemptions_visits_cost_snapshot_check
  CHECK (visits_cost_snapshot IS NULL OR visits_cost_snapshot >= 0);

-- Free redemptions retain a durable ledger entry, redemption code, audit event,
-- inventory update, and idempotency protection even though their unit delta is zero.
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_check;
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_loyalty_delta_check;
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_loyalty_delta_check
  CHECK (
    (loyalty_mode = 'points' AND visits_delta = 0 AND (points_delta <> 0 OR entry_type = 'redeem'))
    OR
    (loyalty_mode = 'visits' AND points_delta = 0 AND (visits_delta <> 0 OR entry_type = 'redeem'))
  );
