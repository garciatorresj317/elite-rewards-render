import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { describe, it } from "node:test";
import sharp from "sharp";
import { themeCatalog } from "./theme-catalog.ts";

const fourKLiveThemes = ["emerald-pulse", "ruby-velocity", "arctic-prism", "golden-horizon"];

describe("4K live-theme assets", () => {
  it("ships every new live wallpaper as an optimized 3840 by 2160 WebP", async () => {
    for (const key of fourKLiveThemes) {
      const theme = themeCatalog.find((item) => item.key === key);
      assert.ok(theme, `${key} is present in the theme catalog`);
      assert.equal(theme.live, true);
      assert.equal(theme.quality, "4K");
      assert.match(theme.image, /^\/themes\/[a-z-]+\.webp$/);
      const path = `public${theme.image}`;
      const [metadata, file] = await Promise.all([sharp(path).metadata(), stat(path)]);
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 3840);
      assert.equal(metadata.height, 2160);
      assert.ok(file.size < 512 * 1024, `${key} remains below the 512 KB wallpaper budget`);
    }
  });
});
