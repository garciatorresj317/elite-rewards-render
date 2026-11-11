import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = (...parts: string[]) => readFile(join(process.cwd(), "src", ...parts), "utf8");

describe("logo-derived futuristic platform theme", () => {
  it("defines the approved gold, electric-blue, cyan, and deep-navy visual system", async () => {
    const styles = await source("styles.css");
    assert.match(styles, /--black: #020713/);
    assert.match(styles, /--cyan: #14e6ff/);
    assert.match(styles, /--blue-deep: #0067dc/);
    assert.match(styles, /Futuristic Elite platform system/);
    assert.match(styles, /elite-chassis-drift/);
  });

  it("covers every page family and honors reduced-motion preferences", async () => {
    const styles = await source("styles.css");
    for (const selector of [
      ".marketing-shell",
      ".auth-page",
      ".admin-shell",
      ".wallet-page",
      ".client-public-page",
      ".business-join-page",
      ".error-screen",
      ".status-screen",
    ]) {
      assert.match(styles, new RegExp(selector.replace(".", "\\.")));
    }
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(styles, /@media \(update: slow\)/);
    assert.match(styles, /\.auth-header/);
    assert.match(styles, /\.auth-icon/);
    assert.match(styles, /\.client-logo-upload:focus-within/);
  });

  it("keeps tenant branding separate from the Elite platform logo", async () => {
    const [styles, brand, businessBrand] = await Promise.all([
      source("styles.css"),
      source("components", "BrandMark.tsx"),
      source("components", "BusinessBrand.tsx"),
    ]);
    assert.match(styles, /Tenant pages retain their own logo and selected colors/);
    assert.match(styles, /var\(--client-primary/);
    assert.match(brand, /elite-rewards-logo\.webp/);
    assert.match(businessBrand, /business\.logo_url/);
  });

  it("uses the futuristic display family and matching browser theme color", async () => {
    const root = await source("routes", "__root.tsx");
    assert.match(root, /family=Inter/);
    assert.match(root, /family=Orbitron/);
    assert.match(root, /content: "#020713"/);
  });
});
