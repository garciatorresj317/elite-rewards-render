import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import type { SessionUser } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import {
  archiveClientProduct,
  createClientProduct,
  createProduct,
  getProductImage,
  listClientProducts,
  listManagedProducts,
  listPublicProducts,
  updateProduct,
  updateProductImage,
} from "./products-service.ts";

const platformOwner: SessionUser = {
  id: "usr_platform",
  businessId: "biz_platform",
  locationId: "loc_platform",
  role: "owner",
  name: "Platform Owner",
  email: "platform@example.com",
  memberCode: null,
  platformAdmin: true,
};
const clientOwner: SessionUser = {
  ...platformOwner,
  id: "usr_client",
  businessId: "biz_client",
  locationId: "loc_client",
  name: "Client Owner",
  email: "client@example.com",
  platformAdmin: false,
};
const otherOwner: SessionUser = {
  ...clientOwner,
  id: "usr_other",
  businessId: "biz_other",
  locationId: "loc_other",
  email: "other@example.com",
};
let pool: pg.Pool;

const draft = {
  name: "Signature Product",
  description: "A business product for members.",
  category: "Featured",
  priceCents: 1599,
  pointsCost: 750,
  imageUrl: "https://example.com/product.webp",
  purchaseUrl: "https://example.com/buy",
  active: true,
};

describe("tenant product catalogs", () => {
  before(async () => {
    const memory = newDb({ autoCreateForeignKeyIndices: true });
    memory.public.registerFunction({
      name: "now",
      returns: DataType.timestamptz,
      implementation: () => new Date(),
    });
    memory.public.registerFunction({
      name: "char_length",
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (value: string) => value.length,
    });
    memory.public.registerFunction({
      name: "octet_length",
      args: [DataType.bytea],
      returns: DataType.integer,
      implementation: (value: Buffer) => value.length,
    });
    const adapter = memory.adapters.createPg();
    pool = new adapter.Pool() as unknown as pg.Pool;
    setDatabasePoolForTests(pool);
    for (const file of [
      "001_production_rewards.sql",
      "002_platform_clients.sql",
      "009_public_enrollment_and_products.sql",
      "010_client_suspension.sql",
      "011_product_images_and_points.sql",
      "015_product_value_limits.sql",
    ]) {
      const sql = await readFile(join(process.cwd(), "migrations", file), "utf8");
      await pool.query(
        file === "015_product_value_limits.sql" ? sql.replaceAll(" NOT VALID", "") : sql,
      );
    }
    await pool.query("ALTER TABLE businesses ADD COLUMN logo_url text");
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN primary_color text NOT NULL DEFAULT '#F6B900'",
    );
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN secondary_color text NOT NULL DEFAULT '#FFE27A'",
    );
    await pool.query(
      "CREATE TABLE platform_administrator(singleton boolean PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES users(id))",
    );
    await pool.query(
      "INSERT INTO businesses(id,name) VALUES ('biz_platform','Elite Rewards'),('biz_client','Big Smoke'),('biz_other','Other Business')",
    );
    await pool.query(
      "INSERT INTO platform_state(singleton,business_id) VALUES (true,'biz_platform')",
    );
    await pool.query(
      "INSERT INTO locations(id,business_id,name) VALUES ('loc_platform','biz_platform','Platform'),('loc_client','biz_client','Main'),('loc_other','biz_other','Other')",
    );
    await pool.query(`INSERT INTO users(id,business_id,location_id,role,name,email,password_hash,platform_admin)
      VALUES ('usr_platform','biz_platform','loc_platform','owner','Platform Owner','platform@example.com','test',true),
             ('usr_client','biz_client','loc_client','owner','Client Owner','client@example.com','test',false),
             ('usr_other','biz_other','loc_other','owner','Other Owner','other@example.com','test',false)`);
    await pool.query(
      "INSERT INTO platform_administrator(singleton,user_id) VALUES (true,'usr_platform')",
    );
  });
  after(async () => closeDatabase());

  it("lets business owners publish products only to their tenant", async () => {
    const created = await createProduct(clientOwner, draft);
    assert.equal(created.name, draft.name);
    assert.equal(created.pointsCost, 750);
    assert.equal((await listManagedProducts(clientOwner)).length, 1);
    assert.equal((await listManagedProducts(otherOwner)).length, 0);
    assert.equal((await listPublicProducts(clientOwner.businessId)).length, 1);
    const updated = await updateProduct(clientOwner, created.id, {
      ...draft,
      name: "Updated Product",
    });
    assert.equal(updated.name, "Updated Product");
    assert.equal((await listPublicProducts(clientOwner.businessId))[0]?.pointsCost, 750);
    // Use an ASCII-only WebP signature because pg-mem's bytea adapter rewrites non-UTF-8
    // bytes; real PostgreSQL preserves the uploaded Buffer exactly.
    const webp = Buffer.from("RIFF0000WEBPVP8 ", "ascii");
    const imageProduct = await updateProductImage(clientOwner, created.id, {
      mime: "image/webp",
      data: webp,
    });
    assert.equal(imageProduct.imageUrl, `/api/public/products/${created.id}/image`);
    assert.deepEqual(await getProductImage(created.id), { mime: "image/webp", data: webp });
    await assert.rejects(
      () =>
        updateProductImage(otherOwner, created.id, {
          mime: "image/webp",
          data: webp,
        }),
      /Product not found/,
    );
    await assert.rejects(() => updateProduct(otherOwner, created.id, draft), /Product not found/);
  });

  it("lets only the platform administrator manage a client catalog", async () => {
    await assert.rejects(
      () => createClientProduct(clientOwner, "biz_other", draft),
      /Platform administrator/,
    );
    const created = await createClientProduct(platformOwner, "biz_other", {
      ...draft,
      name: "Other Product",
    });
    assert.equal((await listClientProducts(platformOwner, "biz_other")).length, 1);
    await archiveClientProduct(platformOwner, "biz_other", created.id);
    assert.equal((await listPublicProducts("biz_other")).length, 0);
    await assert.rejects(
      () => listClientProducts(platformOwner, "biz_platform"),
      /Client not found/,
    );
  });

  it("enforces product price, points, and visits limits in the database", async () => {
    await pool.query(`INSERT INTO business_products(
      id,business_id,name,description,category,price_cents,points_cost,visits_cost,
      active,created_by_user_id,updated_by_user_id
    ) VALUES ('prd_limits','biz_client','Boundary Product','','',9999900,99999,99999,true,'usr_client','usr_client')`);
    await assert.rejects(
      () =>
        pool.query(`INSERT INTO business_products(
          id,business_id,name,description,category,price_cents,points_cost,visits_cost,
          active,created_by_user_id,updated_by_user_id
        ) VALUES ('prd_price_high','biz_client','Price Too High','','',9999901,100,1,true,'usr_client','usr_client')`),
      /business_products_price_cents_check/,
    );
    await assert.rejects(
      () =>
        pool.query(`INSERT INTO business_products(
          id,business_id,name,description,category,price_cents,points_cost,visits_cost,
          active,created_by_user_id,updated_by_user_id
        ) VALUES ('prd_points_high','biz_client','Points Too High','','',0,100000,1,true,'usr_client','usr_client')`),
      /business_products_points_cost_check/,
    );
    await pool.query(`INSERT INTO business_products(
      id,business_id,name,description,category,price_cents,points_cost,visits_cost,
      active,created_by_user_id,updated_by_user_id
    ) VALUES ('prd_visits_preserved','biz_client','Visits Preserved','','',0,100,1000000,true,'usr_client','usr_client')`);
  });
});
