import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const routesDirectory = join(process.cwd(), "src", "routes");

describe("Appearance navigation placement", () => {
  it("keeps appearance controls out of routed business dashboards", async () => {
    const routeFiles = (await readdir(routesDirectory)).filter((file) => file.endsWith(".tsx"));
    const routesWithAppearanceTab: string[] = [];

    for (const file of routeFiles) {
      const source = await readFile(join(routesDirectory, file), "utf8");
      if (
        file !== "admin.tsx" &&
        /(?:label|id|en):\s*["'](?:Appearance|Customization)["']/.test(source)
      )
        routesWithAppearanceTab.push(file);
    }

    assert.deepEqual(routesWithAppearanceTab, []);
  });

  it("keeps appearance customization in a dedicated Elite-only dashboard tab", async () => {
    const adminSource = await readFile(join(routesDirectory, "admin.tsx"), "utf8");

    assert.match(adminSource, /session\.user\.role === ["']member["']/);
    assert.match(adminSource, /id: "Customization"/);
    assert.match(adminSource, /active === "Customization" && user\.platformAdmin/);
    assert.doesNotMatch(adminSource, /api\.updateVisualSettings\(visualDraft\)/);
    assert.match(adminSource, /api\.updateClientVisualSettings/);
    assert.match(adminSource, /Publish client customization/);
    assert.match(adminSource, /name="client-appearance-theme"/);
    assert.match(adminSource, /Only Elite Rewards administrators can publish/);
    assert.equal((adminSource.match(/className="client-appearance-manager"/g) ?? []).length, 1);
    assert.match(adminSource, /className="customization-screen"/);
    assert.match(adminSource, /Elite customization workspace/);
    assert.match(adminSource, /Back to clients/);
    assert.match(adminSource, /Preview client page/);
    assert.match(adminSource, /Loading client customization/);
    assert.match(adminSource, /Discard your unpublished customization changes/);
    assert.match(adminSource, /clientAppearanceRequestRef/);
    assert.doesNotMatch(
      adminSource.slice(
        adminSource.indexOf("{appearanceClient && active"),
        adminSource.indexOf("{clientModal &&"),
      ),
      /role="dialog"|aria-modal="true"|modal-backdrop|appearance-modal/,
    );
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
