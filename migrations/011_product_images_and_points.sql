ALTER TABLE business_products
  ADD COLUMN IF NOT EXISTS points_cost integer,
  ADD COLUMN IF NOT EXISTS visits_cost integer,
  ADD COLUMN IF NOT EXISTS image_data bytea,
  ADD COLUMN IF NOT EXISTS image_mime text;

ALTER TABLE business_products
  DROP CONSTRAINT IF EXISTS business_products_points_cost_check;
ALTER TABLE business_products
  ADD CONSTRAINT business_products_points_cost_check
  CHECK (points_cost >= 1 AND points_cost <= 1000000);

UPDATE business_products
   SET visits_cost = GREATEST(1, (points_cost + 99) / 100)
 WHERE visits_cost IS NULL AND points_cost IS NOT NULL;
ALTER TABLE business_products
  DROP CONSTRAINT IF EXISTS business_products_visits_cost_check;
ALTER TABLE business_products
  ADD CONSTRAINT business_products_visits_cost_check
  CHECK (visits_cost IS NULL OR (visits_cost >= 1 AND visits_cost <= 1000000));

ALTER TABLE business_products
  DROP CONSTRAINT IF EXISTS business_products_image_upload_check;
ALTER TABLE business_products
  ADD CONSTRAINT business_products_image_upload_check
  CHECK (
    (image_data IS NULL AND image_mime IS NULL)
    OR (
      image_data IS NOT NULL
      AND image_mime IN ('image/png', 'image/jpeg', 'image/webp')
      AND octet_length(image_data) <= 4194304
    )
  );