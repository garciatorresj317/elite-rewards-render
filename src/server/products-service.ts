import type { SessionUser } from "./auth.ts";
import { getPool, id } from "./database.ts";

export type ProductDraft = {
  name: string;
  description: string;
  category: string;
  priceCents: number;
  imageUrl: string | null;
  purchaseUrl: string | null;
  active: boolean;
};

export type ManagedProduct = ProductDraft & {
  id: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicProduct = Pick<
  ManagedProduct,
  "id" | "name" | "description" | "category" | "priceCents" | "imageUrl" | "purchaseUrl"
>;

function requireBusinessOwner(user: SessionUser): void {
  if (user.role !== "owner")
    throw Object.assign(new Error("Business owner access required"), { status: 403 });
}

function requirePlatformAdmin(user: SessionUser): void {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
}

function product(row: {
  id: string;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  image_url: string | null;
  purchase_url: string | null;
  active: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): ManagedProduct {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceCents: Number(row.price_cents),
    imageUrl: row.image_url,
    purchaseUrl: row.purchase_url,
    active: row.active,
    archivedAt: row.archived_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const fields = `id,name,description,category,price_cents,image_url,purchase_url,active,archived_at,created_at,updated_at`;

async function assertClientBusiness(businessId: string): Promise<void> {
  const result = await getPool().query(
    `SELECT 1 FROM businesses
      WHERE id = $1
        AND id <> (SELECT business_id FROM platform_state WHERE singleton = true)`,
    [businessId],
  );
  if (!result.rowCount) throw Object.assign(new Error("Client not found"), { status: 404 });
}

export async function listManagedProducts(user: SessionUser): Promise<ManagedProduct[]> {
  if (user.role !== "owner" && user.role !== "staff")
    throw Object.assign(new Error("Business administrator access required"), { status: 403 });
  const result = await getPool().query(
    `SELECT ${fields} FROM business_products
      WHERE business_id = $1 ORDER BY archived_at NULLS FIRST, created_at DESC, id`,
    [user.businessId],
  );
  return result.rows.map(product);
}

export async function listClientProducts(
  user: SessionUser,
  businessId: string,
): Promise<ManagedProduct[]> {
  requirePlatformAdmin(user);
  await assertClientBusiness(businessId);
  const result = await getPool().query(
    `SELECT ${fields} FROM business_products
      WHERE business_id = $1 ORDER BY archived_at NULLS FIRST, created_at DESC, id`,
    [businessId],
  );
  return result.rows.map(product);
}

async function createForBusiness(
  user: SessionUser,
  businessId: string,
  input: ProductDraft,
): Promise<ManagedProduct> {
  const productId = id("prd");
  const result = await getPool().query(
    `INSERT INTO business_products(
       id,business_id,name,description,category,price_cents,image_url,purchase_url,active,
       created_by_user_id,updated_by_user_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
     RETURNING ${fields}`,
    [
      productId,
      businessId,
      input.name,
      input.description,
      input.category,
      input.priceCents,
      input.imageUrl,
      input.purchaseUrl,
      input.active,
      user.id,
    ],
  );
  await getPool().query(
    `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
     VALUES ($1,$2,$3,'business.product.created','business_product',$4,$5)`,
    [id("aud"), businessId, user.id, productId, JSON.stringify({ name: input.name })],
  );
  return product(result.rows[0]);
}

export async function createProduct(
  user: SessionUser,
  input: ProductDraft,
): Promise<ManagedProduct> {
  requireBusinessOwner(user);
  return createForBusiness(user, user.businessId, input);
}

export async function createClientProduct(
  user: SessionUser,
  businessId: string,
  input: ProductDraft,
): Promise<ManagedProduct> {
  requirePlatformAdmin(user);
  await assertClientBusiness(businessId);
  return createForBusiness(user, businessId, input);
}

async function updateForBusiness(
  user: SessionUser,
  businessId: string,
  productId: string,
  input: ProductDraft,
): Promise<ManagedProduct> {
  const result = await getPool().query(
    `UPDATE business_products
        SET name=$4,description=$5,category=$6,price_cents=$7,image_url=$8,purchase_url=$9,
            active=$10,updated_by_user_id=$3,updated_at=now()
      WHERE id=$1 AND business_id=$2 AND archived_at IS NULL
      RETURNING ${fields}`,
    [
      productId,
      businessId,
      user.id,
      input.name,
      input.description,
      input.category,
      input.priceCents,
      input.imageUrl,
      input.purchaseUrl,
      input.active,
    ],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("Product not found"), { status: 404 });
  await getPool().query(
    `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
     VALUES ($1,$2,$3,'business.product.updated','business_product',$4,$5)`,
    [id("aud"), businessId, user.id, productId, JSON.stringify({ name: input.name })],
  );
  return product(row);
}

export async function updateProduct(
  user: SessionUser,
  productId: string,
  input: ProductDraft,
): Promise<ManagedProduct> {
  requireBusinessOwner(user);
  return updateForBusiness(user, user.businessId, productId, input);
}

export async function updateClientProduct(
  user: SessionUser,
  businessId: string,
  productId: string,
  input: ProductDraft,
): Promise<ManagedProduct> {
  requirePlatformAdmin(user);
  await assertClientBusiness(businessId);
  return updateForBusiness(user, businessId, productId, input);
}

async function archiveForBusiness(
  user: SessionUser,
  businessId: string,
  productId: string,
): Promise<void> {
  const result = await getPool().query(
    `UPDATE business_products
        SET active=false,archived_at=now(),updated_by_user_id=$3,updated_at=now()
      WHERE id=$1 AND business_id=$2 AND archived_at IS NULL`,
    [productId, businessId, user.id],
  );
  if (!result.rowCount) throw Object.assign(new Error("Product not found"), { status: 404 });
  await getPool().query(
    `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
     VALUES ($1,$2,$3,'business.product.archived','business_product',$4,'{}')`,
    [id("aud"), businessId, user.id, productId],
  );
}

export async function archiveProduct(user: SessionUser, productId: string): Promise<void> {
  requireBusinessOwner(user);
  return archiveForBusiness(user, user.businessId, productId);
}

export async function archiveClientProduct(
  user: SessionUser,
  businessId: string,
  productId: string,
): Promise<void> {
  requirePlatformAdmin(user);
  await assertClientBusiness(businessId);
  return archiveForBusiness(user, businessId, productId);
}

export async function listPublicProducts(businessId: string): Promise<PublicProduct[]> {
  const result = await getPool().query(
    `SELECT ${fields} FROM business_products
      WHERE business_id = $1 AND active = true AND archived_at IS NULL
      ORDER BY category, name, created_at, id`,
    [businessId],
  );
  return result.rows.map((row) => {
    const item = product(row);
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      priceCents: item.priceCents,
      imageUrl: item.imageUrl,
      purchaseUrl: item.purchaseUrl,
    };
  });
}
