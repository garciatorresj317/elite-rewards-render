-- Products intentionally created from Elite Admin > Clients > Customize Best Budz should
-- be customer-visible. Preserve archived rows, but restore active publication for current rows.
INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
SELECT 'aud_migration_018_' || p.id,
       p.business_id,
       NULL,
       'business.product.visibility.repaired',
       'business_product',
       p.id,
       '{"source":"migration_018","reason":"client customization products are customer-facing"}'::jsonb
  FROM business_products p
 WHERE p.business_id = 'biz_18fedc53-78d9-46bc-a8b0-8eb375154399'
   AND p.active = false
   AND p.archived_at IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE business_products
   SET active = true,
       updated_at = now()
 WHERE business_id = 'biz_18fedc53-78d9-46bc-a8b0-8eb375154399'
   AND active = false
   AND archived_at IS NULL;