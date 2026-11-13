import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("client customization placement", () => {
  it("keeps file upload, client preview, NFC links, and the live message in their required admin areas", async () => {
    const admin = await readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8");
    assert.match(admin, /type="file"/);
    assert.match(admin, /Choose logo from files/);
    assert.match(admin, /Return to default/);
    assert.match(admin, /Restablecer valores predeterminados/);
    assert.match(admin, /resetClientBranding/);
    assert.match(admin, /Open client page/);
    assert.match(admin, /Copy NFC card link/);
    const automaticStart = admin.indexOf('className="panel automatic-theme-editor"');
    const liveMessage = admin.indexOf("Optional live message");
    const themeGrid = admin.indexOf('className="theme-grid"');
    assert.ok(automaticStart >= 0 && liveMessage > automaticStart && liveMessage < themeGrid);
    assert.equal((admin.match(/Optional live message/g) ?? []).length, 1);
  });

  it("renders a bilingual suspend or activate control on every mapped client card", async () => {
    const admin = await readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8");
    const cards = admin.indexOf("clients.map((client) =>");
    const action = admin.indexOf("client-status-action", cards);
    const end = admin.indexOf("</article>", cards);
    assert.ok(cards >= 0 && action > cards && action < end);
    assert.match(admin, /Suspend client/);
    assert.match(admin, /Suspender cliente/);
    assert.match(admin, /Activate client/);
    assert.match(admin, /Activar cliente/);
    assert.match(admin, /suspended: \["Suspended", "Suspendido"\]/);
  });

  it("keeps product image upload and configurable points or visits controls in both admin product workflows", async () => {
    const [admin, clientPage, wallet, uploadLimits] = await Promise.all([
      readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "routes", "clients.$clientId.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "routes", "wallet.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "lib", "upload-limits.ts"), "utf8"),
    ]);
    assert.equal((admin.match(/<ProductEditorFields/g) ?? []).length, 2);
    assert.match(admin, /Choose product image from files/);
    assert.match(admin, /Elegir imagen del producto desde archivos/);
    assert.match(admin, /accept="image\/png,image\/jpeg,image\/webp"/);
    assert.match(admin, /className="product-image-preview"/);
    assert.match(admin, /selectedImagePreview \?\? draft\.imageUrl/);
    assert.match(admin, /productDraftForSave\(\{ \.\.\.clientProductDraft, active: true \}\)/);
    assert.match(admin, /productPayload = productDraftForSave\(productForm\)/);
    assert.match(uploadLimits, /PRODUCT_IMAGE_MAX_MEGABYTES = 10/);
    assert.match(admin, /Price \(\$0–\$99,999\)/);
    assert.match(admin, /Points \(0–99,999\)/);
    assert.match(admin, /max="99999"/);
    assert.doesNotMatch(admin, /Product image URL/);
    assert.doesNotMatch(admin, /Purchase or details URL/);
    assert.doesNotMatch(admin, /URL de compra o detalles/);
    assert.match(admin, /Product details were saved, but the image upload failed/);
    assert.match(admin, /loyaltyMode === "visits" \? draft\.visitsCost : draft\.pointsCost/);
    assert.match(admin, /Choose points or visits/);
    assert.match(admin, /Use visits/);
    assert.match(clientPage, /product\.pointsCost/);
    assert.match(wallet, /product\.pointsCost/);
    assert.match(clientPage, /alt=\{product\.name\}/);
    assert.match(wallet, /alt=\{product\.name\}/);
  });

  it("opens client customization without letting one failed section collapse the editor", async () => {
    const admin = await readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8");
    const loaderStart = admin.indexOf("const openClientEditor");
    const loaderEnd = admin.indexOf("const saveClientBranding", loaderStart);
    const loader = admin.slice(loaderStart, loaderEnd);
    assert.ok(loaderStart >= 0 && loaderEnd > loaderStart);
    assert.match(loader, /setClientEditor\(client\)/);
    assert.match(loader, /Promise\.allSettled/);
    assert.match(loader, /brandingResult\.status === "fulfilled"/);
    assert.match(loader, /rewardsResult\.status === "fulfilled"/);
    assert.match(loader, /productsResult\.status === "fulfilled"/);
    assert.match(loader, /appearanceResult\.status === "fulfilled"/);
    assert.doesNotMatch(loader, /Client customization failed to load/);
  });

  it("provides confirmed bilingual single and bulk product deletion in both admin workflows", async () => {
    const [admin, apiClient, service] = await Promise.all([
      readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "lib", "api-client.ts"), "utf8"),
      readFile(join(process.cwd(), "src", "server", "products-service.ts"), "utf8"),
    ]);
    assert.match(admin, /Select all products/);
    assert.match(admin, /Seleccionar todos los productos/);
    assert.match(admin, /Delete selected/);
    assert.match(admin, /Eliminar seleccionados/);
    assert.match(admin, /Delete product/);
    assert.match(admin, /Eliminar producto/);
    assert.match(admin, /Delete permanently/);
    assert.match(admin, /Eliminar permanentemente/);
    assert.match(admin, /This cannot be undone/);
    assert.match(apiClient, /deleteClientProducts/);
    assert.match(apiClient, /deleteProducts/);
    assert.match(service, /WHERE business_id=\$1 AND id IN/);
    assert.match(service, /business\.products\.deleted/);
  });

  it("publishes Elite-managed client products to the customer and member catalogs", async () => {
    const [admin, database, repairMigration] = await Promise.all([
      readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "server", "database.ts"), "utf8"),
      readFile(
        join(process.cwd(), "migrations", "018_repair_best_budz_product_visibility.sql"),
        "utf8",
      ),
    ]);
    assert.match(
      admin,
      /const publishedDraft = productDraftForSave\(\{ \.\.\.clientProductDraft, active: true \}\)/,
    );
    assert.match(admin, /publishingRequired/);
    assert.match(admin, /Published for customers/);
    assert.match(admin, /client page and member wallets/);
    assert.match(admin, /clientOnly: true/);
    assert.match(admin, /!section\.clientOnly \|\| !user\.platformAdmin/);
    assert.match(admin, /setActive\(user\.platformAdmin \? "Clients" : "Products"\)/);
    assert.match(admin, /Choose a client to update its catalog/);
    assert.match(database, /018_repair_best_budz_product_visibility\.sql/);
    assert.match(repairMigration, /business\.product\.visibility\.repaired/);
    assert.match(repairMigration, /biz_18fedc53-78d9-46bc-a8b0-8eb375154399/);
    assert.match(repairMigration, /archived_at IS NULL/);
  });
});
