ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS inventory_remaining integer CHECK (inventory_remaining IS NULL OR inventory_remaining >= 0),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS reward_name_snapshot text;

UPDATE ledger_entries
   SET reward_name_snapshot = rewards.name
  FROM rewards
 WHERE ledger_entries.reward_id = rewards.id
   AND ledger_entries.reward_name_snapshot IS NULL;

ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS reward_name_snapshot text,
  ADD COLUMN IF NOT EXISTS points_cost_snapshot integer
    CONSTRAINT redemptions_points_cost_snapshot_check
    CHECK (points_cost_snapshot IS NULL OR points_cost_snapshot > 0);

UPDATE redemptions
   SET reward_name_snapshot = rewards.name,
       points_cost_snapshot = rewards.points_cost
  FROM rewards
 WHERE redemptions.reward_id = rewards.id
   AND (redemptions.reward_name_snapshot IS NULL OR redemptions.points_cost_snapshot IS NULL);

CREATE INDEX IF NOT EXISTS rewards_business_status_idx
  ON rewards (business_id, archived_at, active, points_cost);
