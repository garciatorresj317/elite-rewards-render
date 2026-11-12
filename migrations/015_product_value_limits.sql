ALTER TABLE business_products
  DROP CONSTRAINT IF EXISTS business_products_price_cents_check;
ALTER TABLE business_products
  ADD CONSTRAINT business_products_price_cents_check
  CHECK (price_cents >= 0 AND price_cents <= 9999900) NOT VALID;

ALTER TABLE business_products
  DROP CONSTRAINT IF EXISTS business_products_points_cost_check;
ALTER TABLE business_products
  ADD CONSTRAINT business_products_points_cost_check
  CHECK (points_cost IS NULL OR (points_cost >= 0 AND points_cost <= 99999)) NOT VALID;