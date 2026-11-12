import type { SessionUser } from "./auth.ts";
import { getPool, id } from "./database.ts";
import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_MAX_MEGABYTES } from "../lib/upload-limits.ts";

export type ProductDraft = {
  name: string;
  description: string;
  category: string;
  priceCents: number;
  pointsCost: number;
  visitsCost?: number;
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
  | "id"
  | "name"
  | "description"
  | "category"
  | "priceCents"
  | "pointsCost"
  | "imageUrl"
  | "purchaseUrl"
>;

export type ProductImageInput = {
  mime: "image/png" | "image/jpeg" | "image/webp";
  data: Buffer;
};

const publicProductImagePath = (productId: string) =>
  `/api/public/products/${encodeURIComponent(productId)}/image`;
const managedProductImagePath = (productId: string) =>
  `/api/admin/products/${encodeURIComponent(productId)}/image`;
const managedClientProductImagePath = (businessId: string, productId: string) =>
  `/api/admin/clients/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId)}/image`;

function requireBusinessOwner(user: SessionUser): void {
  if (user.role !== "owner")
    throw Object.assign(new Error("Business owner access required"), { status: 403 });
}

function requirePlatformAdmin(user: SessionUser): void {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
}

function product(
  row: {
    id: string;
    name: string;
    description: string;
    category: string;
    price_cents: number;
    points_cost: number | null;
    visits_cost: number | null;
    image_url: string | null;
    has_image: boolean;
    purchase_url: string | null;
    active: boolean;
    archived_at: Date | null;
    created_at: Date;
    updated_at: Date;
  },
  imagePath: (productId: string) => string = publicProductImagePath,
): ManagedProduct {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceCents: Number(row.price_cents),
    pointsCost: row.points_cost === null ? 0 : Number(row.points_cost),
    visitsCost: row.visits_cost === null ? 0 : Number(row.visits_cost),
    imageUrl: row.has_image ? imagePath(row.id) : row.image_url,
    purchaseUrl: row.purchase_url,
    active: row.active,
    archivedAt: row.archived_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const fields = `id,name,description,category,price_cents,points_cost,visits_cost,image_url,purchase_url,
  (image_data IS NOT NULL) AS has_image,active,archived_at,created_at,updated_at`;

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
  return result.rows.map((row) => product(row, managedProductImagePath));
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
  return result.rows.map((row) =>
    product(row, (productId) => managedClientProductImagePath(businessId, productId)),
  );
}

async function createForBusiness(
  user: SessionUser,
  businessId: string,
  input: ProductDraft,
): Promise<ManagedProduct> {
  const productId = id("prd");
  const result = await getPool().query(
    `INSERT INTO business_products(
       id,business_id,name,description,category,price_cents,points_cost,visits_cost,image_url,purchase_url,active,
       created_by_user_id,updated_by_user_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
     RETURNING ${fields}`,
    [
      productId,
      businessId,
      input.name,
      input.description,
      input.category,
      input.priceCents,
      input.pointsCost,
      input.visitsCost ?? Math.max(1, Math.ceil(input.pointsCost / 100)),
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
  return product(
    result.rows[0],
    user.platformAdmin
      ? (createdProductId) => managedClientProductImagePath(businessId, createdProductId)
      : managedProductImagePath,
  );
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
        SET name=$4,description=$5,category=$6,price_cents=$7,points_cost=$8,visits_cost=$9,image_url=$10,purchase_url=$11,
            active=$12,updated_by_user_id=$3,updated_at=now()
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
      input.pointsCost,
      input.visitsCost ?? Math.max(1, Math.ceil(input.pointsCost / 100)),
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
  return product(
    row,
    user.platformAdmin
      ? (updatedProductId) => managedClientProductImagePath(businessId, updatedProductId)
      : managedProductImagePath,
  );
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

async function deleteForBusiness(
  user: SessionUser,
  businessId: string,
  productIds: string[],
): Promise<number> {
  const uniqueProductIds = [...new Set(productIds)];
  if (!uniqueProductIds.length || uniqueProductIds.length > 100)
    throw Object.assign(new Error("Choose between 1 and 100 products"), { status: 400 });

  const connection = await getPool().connect();
  const placeholders = uniqueProductIds.map((_, index) => `$${index + 2}`).join(",");
  const parameters = [businessId, ...uniqueProductIds];
  try {
    await connection.query("BEGIN");
    const existing = await connection.query<{ id: string; name: string }>(
      `SELECT id,name FROM business_products
        WHERE business_id=$1 AND id IN (${placeholders})
        FOR UPDATE`,
      parameters,
    );
    if (existing.rowCount !== uniqueProductIds.length)
      throw Object.assign(new Error("One or more products were not found"), { status: 404 });

    await connection.query(
      `DELETE FROM business_products
        WHERE business_id=$1 AND id IN (${placeholders})`,
      parameters,
    );
    await connection.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'business.products.deleted','business_product_batch',$4,$5)`,
      [
        id("aud"),
        businessId,
        user.id,
        uniqueProductIds.length === 1 ? uniqueProductIds[0] : "multiple",
        JSON.stringify({
          count: uniqueProductIds.length,
          products: existing.rows.map((item) => ({ id: item.id, name: item.name })),
        }),
      ],
    );
    await connection.query("COMMIT");
    return uniqueProductIds.length;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteProducts(user: SessionUser, productIds: string[]): Promise<number> {
  requireBusinessOwner(user);
  return deleteForBusiness(user, user.businessId, productIds);
}

export async function deleteClientProducts(
  user: SessionUser,
  businessId: string,
  productIds: string[],
): Promise<number> {
  requirePlatformAdmin(user);
  await assertClientBusiness(businessId);
  return deleteForBusiness(user, businessId, productIds);
}

function validateProductImage(input: ProductImageInput): void {
  if (!input.data.length || input.data.length > PRODUCT_IMAGE_MAX_BYTES)
    throw Object.assign(
      new Error(`Product image must be ${PRODUCT_IMAGE_MAX_MEGABYTES} MB or smaller`),
      { status: 400 },
    );
  const signatures: Record<ProductImageInput["mime"], (data: Buffer) => boolean> = {
    "image/png": (data) => data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
    "image/jpeg": (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
    "image/webp": (data) =>
      data.subarray(0, 4).toString("ascii") === "RIFF" &&
      data.subarray(8, 12).toString("ascii") === "WEBP",
  };
  if (!signatures[input.mime](input.data))
    throw Object.assign(new Error("Product image content does not match its image type"), {
      status: 400,
    });
}

async function updateImageForBusiness(
  user: SessionUser,
  businessId: string,
  productId: string,
  input: ProductImageInput,
): Promise<ManagedProduct> {
  validateProductImage(input);
  const result = await getPool().query(
    `UPDATE business_products
        SET image_data=$4,image_mime=$5,image_url=NULL,updated_by_user_id=$3,updated_at=now()
      WHERE id=$1 AND business_id=$2 AND archived_at IS NULL
      RETURNING ${fields}`,
    [productId, businessId, user.id, input.data, input.mime],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("Product not found"), { status: 404 });
  await getPool().query(
    `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
     VALUES ($1,$2,$3,'business.product.image.updated','business_product',$4,$5)`,
    [
      id("aud"),
      businessId,
      user.id,
      productId,
      JSON.stringify({ mime: input.mime, bytes: input.data.length }),
    ],
  );
  return product(
    row,
    user.platformAdmin
      ? (updatedProductId) => managedClientProductImagePath(businessId, updatedProductId)
      : managedProductImagePath,
  );
}

export async function updateProductImage(
  user: SessionUser,
  productId: string,
  input: ProductImageInput,
): Promise<ManagedProduct> {
  requireBusinessOwner(user);
  return updateImageForBusiness(user, user.businessId, productId, input);
}

export async function updateClientProductImage(
  user: SessionUser,
  businessId: string,
  productId: string,
  input: ProductImageInput,
): Promise<ManagedProduct> {
  requirePlatformAdmin(user);
  await assertClientBusiness(businessId);
  return updateImageForBusiness(user, businessId, productId, input);
}

export async function getProductImage(
  productId: string,
): Promise<{ mime: string; data: Buffer } | null> {
  const result = await getPool().query<{ image_mime: string | null; image_data: Buffer | null }>(
    `SELECT p.image_mime,p.image_data
       FROM business_products p
       JOIN businesses b ON b.id=p.business_id
      WHERE p.id=$1 AND p.active=true AND p.archived_at IS NULL AND b.active=true
        AND b.id<>(SELECT business_id FROM platform_state WHERE singleton=true)`,
    [productId],
  );
  const row = result.rows[0];
  return row?.image_mime && row.image_data ? { mime: row.image_mime, data: row.image_data } : null;
}

export async function getManagedProductImage(
  user: SessionUser,
  productId: string,
): Promise<{ mime: string; data: Buffer } | null> {
  if (user.role !== "owner" && user.role !== "staff")
    throw Object.assign(new Error("Business administrator access required"), { status: 403 });
  const result = await getPool().query<{ image_mime: string | null; image_data: Buffer | null }>(
    `SELECT image_mime,image_data FROM business_products WHERE id=$1 AND business_id=$2`,
    [productId, user.businessId],
  );
  const row = result.rows[0];
  return row?.image_mime && row.image_data ? { mime: row.image_mime, data: row.image_data } : null;
}

export async function getManagedClientProductImage(
  user: SessionUser,
  businessId: string,
  productId: string,
): Promise<{ mime: string; data: Buffer } | null> {
  requirePlatformAdmin(user);
  await assertClientBusiness(businessId);
  const result = await getPool().query<{ image_mime: string | null; image_data: Buffer | null }>(
    `SELECT image_mime,image_data FROM business_products WHERE id=$1 AND business_id=$2`,
    [productId, businessId],
  );
  const row = result.rows[0];
  return row?.image_mime && row.image_data ? { mime: row.image_mime, data: row.image_data } : null;
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
      pointsCost: item.pointsCost,
      visitsCost: item.visitsCost,
      imageUrl: item.imageUrl,
      purchaseUrl: item.purchaseUrl,
    };
  });
}
