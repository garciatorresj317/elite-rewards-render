import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { describe, it } from "node:test";
import sharp from "sharp";
import { themeCatalog } from "./theme-catalog.ts";

describe("4K live-theme assets", () => {
  it("ships every customization theme as an optimized live 3840 by 2160 WebP", async () => {
    assert.equal(themeCatalog.length, 14);
    assert.equal(new Set(themeCatalog.map((theme) => theme.key)).size, themeCatalog.length);
    assert.equal(new Set(themeCatalog.map((theme) => theme.image)).size, themeCatalog.length);
    for (const theme of themeCatalog) {
      assert.equal(theme.live, true);
      assert.equal(theme.quality, "4K");
      assert.match(theme.image, /^\/themes\/[a-z0-9-]+(?:-live)?\.webp$/);
      const path = `public${theme.image}`;
      const [metadata, file] = await Promise.all([sharp(path).metadata(), stat(path)]);
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 3840);
      assert.equal(metadata.height, 2160);
      assert.ok(file.size < 512 * 1024, `${theme.key} remains below the 512 KB budget`);
    }
  });
});
