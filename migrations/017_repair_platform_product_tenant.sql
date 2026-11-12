-- The Elite platform business is not a customer catalog. A product created through the
-- platform-level Products tab could be stored there and remain invisible to customers.
-- Repair the reported Best Budz Clothing data only when that exact client still exists.
INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
SELECT 'aud_migration_017_' || p.id,
       'biz_18fedc53-78d9-46bc-a8b0-8eb375154399',
       NULL,
       'business.product.tenant.repaired',
       'business_product',
       p.id,
       '{"source":"migration_017","reason":"platform catalogs are not customer-facing"}'::jsonb
  FROM business_products p
 WHERE p.business_id = (SELECT business_id FROM platform_state WHERE singleton = true)
   AND EXISTS (
     SELECT 1 FROM businesses
      WHERE id = 'biz_18fedc53-78d9-46bc-a8b0-8eb375154399'
   )
ON CONFLICT (id) DO NOTHING;

UPDATE business_products
   SET business_id = 'biz_18fedc53-78d9-46bc-a8b0-8eb375154399',
       updated_at = now()
 WHERE business_id = (SELECT business_id FROM platform_state WHERE singleton = true)
   AND EXISTS (
     SELECT 1 FROM businesses
      WHERE id = 'biz_18fedc53-78d9-46bc-a8b0-8eb375154399'
   );
