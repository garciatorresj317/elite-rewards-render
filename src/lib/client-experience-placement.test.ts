import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("client customization placement", () => {
  it("keeps file upload, client preview, NFC links, and the dedicated appearance tab in their required admin areas", async () => {
    const admin = await readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8");
    assert.match(admin, /type="file"/);
    assert.match(admin, /Choose logo from files/);
    assert.match(admin, /Return to default/);
    assert.match(admin, /Restablecer valores predeterminados/);
    assert.match(admin, /resetClientBranding/);
    assert.match(admin, /Open client page/);
    assert.match(admin, /Copy NFC card link/);
    assert.match(admin, /id: "Customization"/);
    const appearanceStart = admin.indexOf('className="client-appearance-manager"');
    const liveMessage = admin.indexOf("Live message headline", appearanceStart);
    const themeGrid = admin.indexOf('className="theme-grid client-theme-grid"', appearanceStart);
    assert.ok(appearanceStart >= 0 && themeGrid > appearanceStart && liveMessage > themeGrid);
    assert.equal((admin.match(/Live message headline/g) ?? []).length, 1);
    assert.ok(admin.indexOf('active === "Customization"') < appearanceStart);
    const clientEditorStart = admin.indexOf("{clientEditor && (");
    const appearanceEditorStart = admin.indexOf("{appearanceClient && (");
    assert.ok(clientEditorStart >= 0 && appearanceEditorStart > clientEditorStart);
    assert.doesNotMatch(
      admin.slice(clientEditorStart, appearanceEditorStart),
      /Live message headline/,
    );
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

  it("keeps points-per-dollar editing in Elite client management only", async () => {
    const [admin, apiClient, service, migration] = await Promise.all([
      readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "lib", "api-client.ts"), "utf8"),
      readFile(join(process.cwd(), "src", "server", "rewards-service.ts"), "utf8"),
      readFile(join(process.cwd(), "migrations", "020_points_per_dollar.sql"), "utf8"),
    ]);
    assert.equal((admin.match(/Points earned per \$1/g) ?? []).length, 1);
    assert.equal((admin.match(/Puntos otorgados por cada \$1/g) ?? []).length, 1);
    assert.match(admin, /Save points rate/);
    assert.match(admin, /Guardar tasa de puntos/);
    assert.match(admin, /pointsPerDollar/);
    assert.doesNotMatch(admin, /value=\{award\.points\}/);
    assert.match(apiClient, /JSON\.stringify\(\{ loyaltyMode, pointsPerDollar \}\)/);
    assert.doesNotMatch(apiClient, /updateLoyaltySettings:/);
    assert.match(
      service,
      /Math\.floor\(\(input\.amountCents \* Number\(businessRow\.points_per_dollar\)\) \/ 100\)/,
    );
    assert.match(migration, /points_per_dollar integer NOT NULL DEFAULT 1/);
    assert.match(migration, /BETWEEN 1 AND 1000/);
  });

  it("keeps product image upload and configurable points or visits controls in both admin product workflows", async () => {
    const [admin, clientPage, wallet, productCatalog, uploadLimits] = await Promise.all([
      readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "routes", "clients.$clientId.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "routes", "wallet.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "components", "ProductCatalog.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "lib", "upload-limits.ts"), "utf8"),
    ]);
    assert.equal((admin.match(/<ProductEditorFields/g) ?? []).length, 2);
    assert.match(admin, /Choose product image from files/);
    assert.match(admin, /Elegir imagen del producto desde archivos/);
    assert.match(admin, /accept="image\/png,image\/jpeg,image\/webp"/);
    assert.match(admin, /className="product-image-preview"/);
    assert.match(admin, /selectedImagePreview \?\? draft\.imageUrl/);
    assert.match(admin, /Image background/);
    assert.match(admin, /Fondo de la imagen/);
    assert.match(admin, /Make transparent/);
    assert.match(admin, /Hacer transparente/);
    assert.match(admin, /Use any color/);
    assert.match(admin, /type="color"/);
    assert.match(admin, /imageBackground=\{clientProductBackground\}/);
    assert.match(admin, /imageBackground=\{productBackground\}/);
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
    assert.match(admin, /Choose what this business awards/);
    assert.match(admin, /Use visits/);
    assert.match(clientPage, /<ProductCatalog products=\{data\.products\}/);
    assert.match(wallet, /<ProductCatalog[\s\S]*products=\{data\.products\}/);
    assert.match(productCatalog, /product\.pointsCost/);
    assert.match(productCatalog, /alt=\{product\.name\}/);
  });

  it("opens client customization without letting one failed section collapse the editor", async () => {
    const admin = await readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8");
    const loaderStart = admin.indexOf("const openClientEditor");
    const loaderEnd = admin.indexOf("const openClientAppearance", loaderStart);
    const loader = admin.slice(loaderStart, loaderEnd);
    assert.ok(loaderStart >= 0 && loaderEnd > loaderStart);
    assert.match(loader, /setClientEditor\(client\)/);
    assert.match(loader, /Promise\.allSettled/);
    assert.match(loader, /brandingResult\.status === "fulfilled"/);
    assert.match(loader, /rewardsResult\.status === "fulfilled"/);
    assert.match(loader, /productsResult\.status === "fulfilled"/);
    assert.match(loader, /loyaltyResult\.status === "fulfilled"/);
    assert.doesNotMatch(loader, /api\.clientVisualSettings/);
    assert.doesNotMatch(loader, /Client customization failed to load/);
    const appearanceStart = admin.indexOf("const openClientAppearance");
    const appearanceEnd = admin.indexOf("const saveClientBranding", appearanceStart);
    const appearanceLoader = admin.slice(appearanceStart, appearanceEnd);
    assert.match(appearanceLoader, /api\.clientVisualSettings/);
    assert.match(appearanceLoader, /setAppearanceClient\(client\)/);
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

  it("allows archived rewards to be restored as hidden in both management flows", async () => {
    const [admin, apiClient, service] = await Promise.all([
      readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "lib", "api-client.ts"), "utf8"),
      readFile(join(process.cwd(), "src", "server", "reward-management-service.ts"), "utf8"),
    ]);
    assert.match(admin, /Unarchive reward/);
    assert.match(admin, /Desarchivar recompensa/);
    assert.match(admin, /restoreClientReward/);
    assert.match(apiClient, /restoreReward:/);
    assert.match(apiClient, /restoreClientReward:/);
    assert.match(service, /reward\.restored/);
    assert.match(service, /SET active = false, archived_at = NULL/);
  });
});

describe("complete Elite-only client experience customization", () => {
  it("covers slogans, page messages, palettes, live themes, styles, and visible customer sections", async () => {
    const [admin, service, publicPage, joinPage, wallet, migration] = await Promise.all([
      readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "server", "experience-service.ts"), "utf8"),
      readFile(join(process.cwd(), "src", "routes", "clients.$clientId.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "routes", "join.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "routes", "wallet.tsx"), "utf8"),
      readFile(
        join(process.cwd(), "migrations", "021_full_client_experience_customization.sql"),
        "utf8",
      ),
    ]);
    assert.match(admin, /Company slogan/);
    assert.match(admin, /Company slogan — Spanish/);
    assert.match(admin, /Public page headline/);
    assert.match(admin, /Join Rewards headline/);
    assert.match(admin, /Member wallet headline/);
    assert.match(admin, /Full customer palette/);
    assert.match(admin, /Heading style/);
    assert.match(admin, /Customer page sections/);
    for (const key of ["cosmic-neon", "royal-purple", "ocean-glow", "sunset-energy"])
      assert.match(admin, new RegExp(key));
    assert.match(service, /requirePlatformAdmin\(user\)/);
    assert.match(service, /platform\.client\.visual_settings\.updated/);
    assert.match(publicPage, /publicHeadline/);
    assert.match(publicPage, /showRewards/);
    assert.match(joinPage, /joinHeadline/);
    assert.match(wallet, /memberHeadline/);
    assert.match(wallet, /showReferrals/);
    assert.match(migration, /company_slogan/);
    assert.match(migration, /company_slogan_es/);
    assert.match(migration, /show_products/);
    assert.match(admin, /clientAppearanceBusy/);
    assert.match(admin, /appearanceDialogRef/);
  });
});
