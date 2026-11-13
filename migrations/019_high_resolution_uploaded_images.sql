ALTER TABLE business_products
  ADD COLUMN IF NOT EXISTS image_width integer,
  ADD COLUMN IF NOT EXISTS image_height integer,
  ADD COLUMN IF NOT EXISTS image_processing_version integer NOT NULL DEFAULT 0;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS logo_width integer,
  ADD COLUMN IF NOT EXISTS logo_height integer,
  ADD COLUMN IF NOT EXISTS logo_processing_version integer NOT NULL DEFAULT 0;

ALTER TABLE business_products
  DROP CONSTRAINT IF EXISTS business_products_image_dimensions_check;

ALTER TABLE business_products
  ADD CONSTRAINT business_products_image_dimensions_check
  CHECK (
    (image_data IS NULL AND image_width IS NULL AND image_height IS NULL AND image_processing_version = 0)
    OR (
      image_data IS NOT NULL
      AND (
        image_processing_version = 0
        OR (
          image_width IS NOT NULL AND image_width > 0
          AND image_height IS NOT NULL AND image_height > 0
          AND image_processing_version > 0
        )
      )
    )
  ) NOT VALID;

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_logo_dimensions_check;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_logo_dimensions_check
  CHECK (
    (logo_data IS NULL AND logo_width IS NULL AND logo_height IS NULL AND logo_processing_version = 0)
    OR (
      logo_data IS NOT NULL
      AND (
        logo_processing_version = 0
        OR (
          logo_width IS NOT NULL AND logo_width > 0
          AND logo_height IS NOT NULL AND logo_height > 0
          AND logo_processing_version > 0
        )
      )
    )
  ) NOT VALID;