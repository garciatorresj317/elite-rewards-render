ALTER TABLE business_visual_settings
  ADD COLUMN IF NOT EXISTS business_name_color text NOT NULL DEFAULT '#FFE27A';

ALTER TABLE business_visual_settings
  DROP CONSTRAINT IF EXISTS business_visual_settings_business_name_color_check;

ALTER TABLE business_visual_settings
  ADD CONSTRAINT business_visual_settings_business_name_color_check
  CHECK (
    char_length(business_name_color) = 7
    AND substring(business_name_color, 1, 1) = '#'
    AND upper(substring(business_name_color, 2, 1)) IN ('0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F')
    AND upper(substring(business_name_color, 3, 1)) IN ('0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F')
    AND upper(substring(business_name_color, 4, 1)) IN ('0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F')
    AND upper(substring(business_name_color, 5, 1)) IN ('0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F')
    AND upper(substring(business_name_color, 6, 1)) IN ('0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F')
    AND upper(substring(business_name_color, 7, 1)) IN ('0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F')
  );