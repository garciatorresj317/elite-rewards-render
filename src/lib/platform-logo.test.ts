import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("Elite Rewards uses the transparent platform logo without replacing business branding", () => {
  const brandMark = read("src/components/BrandMark.tsx");
  const businessBrand = read("src/components/BusinessBrand.tsx");
  const rootRoute = read("src/routes/__root.tsx");

  assert.match(brandMark, /src="\/elite-rewards-logo\.webp"/);
  assert.match(brandMark, /alt=""/);
  assert.match(businessBrand, /business\.logo_url/);
  assert.match(rootRoute, /href: "\/favicon\.png"/);
});

test("the high-resolution platform logo is a 3072 by 2048 RGBA PNG", () => {
  const logo = readFileSync(join(root, "public/elite-rewards-logo.png"));

  assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(logo.readUInt32BE(16), 3072);
  assert.equal(logo.readUInt32BE(20), 2048);
  assert.equal(logo[25], 6, "PNG color type must be RGBA with transparency");
  assert.ok(
    logo.includes(Buffer.from([0, 0, 0, 0])),
    "PNG data must contain fully transparent pixels",
  );
});
