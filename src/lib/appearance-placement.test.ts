import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const routesDirectory = join(process.cwd(), "src", "routes");

describe("Appearance navigation placement", () => {
  it("keeps appearance controls out of routed client dashboards", async () => {
    const routeFiles = (await readdir(routesDirectory)).filter((file) => file.endsWith(".tsx"));
    const routesWithAppearanceTab: string[] = [];

    for (const file of routeFiles) {
      const source = await readFile(join(routesDirectory, file), "utf8");
      if (/(?:label|id|en):\s*["']Appearance["']/.test(source)) routesWithAppearanceTab.push(file);
    }

    assert.deepEqual(routesWithAppearanceTab, []);
  });

  it("keeps appearance customization inside Elite client management", async () => {
    const adminSource = await readFile(join(routesDirectory, "admin.tsx"), "utf8");

    assert.match(adminSource, /session\.user\.role === ["']member["']/);
    assert.doesNotMatch(adminSource, /active === ["']Appearance["']/);
    assert.doesNotMatch(adminSource, /api\.updateVisualSettings\(visualDraft\)/);
    assert.match(adminSource, /api\.updateClientVisualSettings/);
    assert.match(adminSource, /Publish client appearance/);
    assert.match(adminSource, /name="client-theme"/);
  });

  it("keeps automatic theme controls out of every non-admin route", async () => {
    const routeFiles = (await readdir(routesDirectory)).filter(
      (file) => file.endsWith(".tsx") && file !== "admin.tsx",
    );
    for (const file of routeFiles) {
      const source = await readFile(join(routesDirectory, file), "utf8");
      assert.doesNotMatch(source, /Automatic holiday themes|automaticHolidayThemes/);
    }
  });
});
