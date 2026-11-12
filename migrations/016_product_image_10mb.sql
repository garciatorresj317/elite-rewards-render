ALTER TABLE business_products
  DROP CONSTRAINT IF EXISTS business_products_image_upload_check;

ALTER TABLE business_products
  ADD CONSTRAINT business_products_image_upload_check
  CHECK (
    (image_data IS NULL AND image_mime IS NULL)
    OR (
      image_data IS NOT NULL
      AND image_mime IN ('image/png', 'image/jpeg', 'image/webp')
      AND octet_length(image_data) <= 10485760
    )
  );