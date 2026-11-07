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

  it("keeps product image upload and points controls in both admin product workflows", async () => {
    const [admin, clientPage, wallet] = await Promise.all([
      readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "routes", "clients.$clientId.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "routes", "wallet.tsx"), "utf8"),
    ]);
    assert.equal((admin.match(/<ProductEditorFields/g) ?? []).length, 2);
    assert.match(admin, /Choose product image from files/);
    assert.match(admin, /Elegir imagen del producto desde archivos/);
    assert.match(admin, /accept="image\/png,image\/jpeg,image\/webp"/);
    assert.match(admin, /value=\{draft\.pointsCost\}/);
    assert.match(clientPage, /product\.pointsCost/);
    assert.match(wallet, /product\.pointsCost/);
    assert.match(clientPage, /alt=\{product\.name\}/);
    assert.match(wallet, /alt=\{product\.name\}/);
  });
});
