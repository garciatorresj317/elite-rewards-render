CREATE TABLE IF NOT EXISTS business_products (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  category text NOT NULL DEFAULT '' CHECK (char_length(category) <= 80),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0 AND price_cents <= 100000000),
  image_url text,
  purchase_url text,
  active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (image_url IS NULL OR char_length(image_url) <= 2048),
  CHECK (purchase_url IS NULL OR char_length(purchase_url) <= 2048)
);

CREATE INDEX IF NOT EXISTS business_products_business_active_idx
  ON business_products (business_id, active, created_at DESC)
  WHERE archived_at IS NULL;
