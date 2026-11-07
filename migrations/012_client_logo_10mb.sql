ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_logo_upload_check;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_logo_upload_check
  CHECK (
    (logo_data IS NULL AND logo_mime IS NULL)
    OR (
      logo_data IS NOT NULL
      AND logo_mime IN ('image/png', 'image/jpeg', 'image/webp')
      AND octet_length(logo_data) <= 10485760
    )
  );