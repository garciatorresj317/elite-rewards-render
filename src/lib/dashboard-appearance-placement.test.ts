import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function source(...parts: string[]) {
  return readFile(join(process.cwd(), "src", ...parts), "utf8");
}

describe("Elite dashboard appearance placement", () => {
  it("keeps platform dashboard design separate from client customization", async () => {
    const [admin, apiClient, api, service, database, migration, styles] = await Promise.all([
      source("routes", "admin.tsx"),
      source("lib", "api-client.ts"),
      source("server", "api.ts"),
      source("server", "dashboard-appearance-service.ts"),
      source("server", "database.ts"),
      readFile(join(process.cwd(), "migrations", "028_platform_dashboard_appearance.sql"), "utf8"),
      source("styles.css"),
    ]);

    assert.match(admin, /id: "Elite Dashboard"/);
    assert.match(admin, /active === "Elite Dashboard" && user\.platformAdmin/);
    assert.match(admin, /active === "Customization" && user\.platformAdmin/);
    assert.match(admin, /These settings are separate from every client/);
    assert.match(admin, /api\.updateDashboardAppearance/);
    assert.match(admin, /api\.resetDashboardAppearance/);
    assert.match(apiClient, /\/api\/admin\/dashboard-appearance/);
    assert.match(api, /requirePlatformAdmin\(user\)[\s\S]*updateDashboardAppearance/);
    assert.match(service, /Platform administrator access required/);
    assert.match(database, /028_platform_dashboard_appearance\.sql/);
    assert.match(migration, /platform_dashboard_appearance/);
    assert.match(admin, /dashboard-background-\$\{dashboardAppearanceDraft\.backgroundStyle\}/);
    assert.match(admin, /user\.platformAdmin[\s\S]*dashboard-customized/);
    assert.match(styles, /admin-shell\.dashboard-customized/);
    assert.match(styles, /dashboard-background-grid/);
    assert.match(styles, /dashboard-background-aurora/);
    assert.match(styles, /dashboard-interface-executive/);
    assert.match(styles, /prefers-reduced-motion/);
  });
});
