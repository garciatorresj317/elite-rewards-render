import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("client customization placement", () => {
  it("keeps file upload, client preview, NFC links, and the live message in their required admin areas", async () => {
    const admin = await readFile(join(process.cwd(), "src", "routes", "admin.tsx"), "utf8");
    assert.match(admin, /type="file"/);
    assert.match(admin, /Choose logo from files/);
    assert.match(admin, /Open client page/);
    assert.match(admin, /Copy NFC card link/);
    const automaticStart = admin.indexOf('className="panel automatic-theme-editor"');
    const liveMessage = admin.indexOf("Optional live message");
    const themeGrid = admin.indexOf('className="theme-grid"');
    assert.ok(automaticStart >= 0 && liveMessage > automaticStart && liveMessage < themeGrid);
    assert.equal((admin.match(/Optional live message/g) ?? []).length, 1);
  });
});
