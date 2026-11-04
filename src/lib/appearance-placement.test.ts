import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const routesDirectory = join(process.cwd(), "src", "routes");

describe("Appearance navigation placement", () => {
  it("exposes the Appearance tab only from the admin route", async () => {
    const routeFiles = (await readdir(routesDirectory)).filter((file) => file.endsWith(".tsx"));
    const routesWithAppearanceTab: string[] = [];

    for (const file of routeFiles) {
      const source = await readFile(join(routesDirectory, file), "utf8");
      if (/label:\s*["']Appearance["']/.test(source)) routesWithAppearanceTab.push(file);
    }

    assert.deepEqual(routesWithAppearanceTab, ["admin.tsx"]);
  });

  it("keeps Appearance inside the authenticated admin section", async () => {
    const adminSource = await readFile(join(routesDirectory, "admin.tsx"), "utf8");

    assert.match(adminSource, /session\.user\.role === ["']member["']/);
    assert.match(adminSource, /active === ["']Appearance["']/);
    assert.match(adminSource, /api\.updateVisualSettings\(visualDraft\)/);
  });
});
