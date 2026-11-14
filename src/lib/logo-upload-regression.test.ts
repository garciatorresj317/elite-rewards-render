import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CLIENT_LOGO_MAX_BYTES,
  CLIENT_LOGO_MAX_MEGABYTES,
  PRODUCT_IMAGE_MAX_BYTES,
} from "./upload-limits.ts";

const source = (...parts: string[]) => readFile(join(process.cwd(), "src", ...parts), "utf8");

describe("business logo upload contract", () => {
  it("raises only business logos to 25 MB and keeps product images at 10 MB", () => {
    assert.equal(CLIENT_LOGO_MAX_BYTES, 25 * 1024 * 1024);
    assert.equal(CLIENT_LOGO_MAX_MEGABYTES, 25);
    assert.equal(PRODUCT_IMAGE_MAX_BYTES, 10 * 1024 * 1024);
  });

  it("keeps the customization-screen file picker and bounded server reader", async () => {
    const [admin, api, migration] = await Promise.all([
      source("routes", "admin.tsx"),
      source("server", "api.ts"),
      readFile(join(process.cwd(), "migrations", "027_client_logo_25mb.sql"), "utf8"),
    ]);
    assert.match(admin, /customization-logo-section/);
    assert.match(admin, /accept="image\/png,image\/jpeg,image\/webp"/);
    assert.match(admin, /CLIENT_LOGO_MAX_MEGABYTES/);
    assert.match(api, /request\.body\.getReader\(\)/);
    assert.match(api, /if \(totalBytes > maxBytes\)/);
    assert.match(migration, /octet_length\(logo_data\) <= 26214400/);
  });
});
