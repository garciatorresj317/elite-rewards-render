import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import type { SessionUser } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import {
  getDashboardAppearance,
  resetDashboardAppearance,
  updateDashboardAppearance,
} from "./dashboard-appearance-service.ts";

const platformAdmin: SessionUser = {
  id: "usr_platform",
  businessId: "biz_platform",
  locationId: "loc_platform",
  role: "owner",
  name: "Platform Owner",
  email: "platform@example.com",
  memberCode: null,
  platformAdmin: true,
};
const ordinaryOwner: SessionUser = {
  ...platformAdmin,
  id: "usr_owner",
  businessId: "biz_client",
  email: "owner@example.com",
  platformAdmin: false,
};

let pool: pg.Pool;

describe("platform dashboard appearance", () => {
  before(async () => {
    const memory = newDb({ autoCreateForeignKeyIndices: true });
    memory.public.registerFunction({
      name: "now",
      returns: DataType.timestamptz,
      implementation: () => new Date(),
    });
    const adapter = memory.adapters.createPg();
    pool = new adapter.Pool() as unknown as pg.Pool;
    setDatabasePoolForTests(pool);
    const migration = await readFile(
      join(process.cwd(), "migrations", "028_platform_dashboard_appearance.sql"),
      "utf8",
    );
    await pool.query(
      migration
        .replaceAll(" CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$')", "")
        .replaceAll(" CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$')", "")
        .replaceAll(" CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$')", "")
        .replaceAll(" CHECK (surface_color ~ '^#[0-9A-Fa-f]{6}$')", "")
        .replaceAll(" CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$')", "")
        .replaceAll(" CHECK (muted_color ~ '^#[0-9A-Fa-f]{6}$')", ""),
    );
  });

  after(async () => closeDatabase());

  it("returns a safe default dashboard design", async () => {
    const appearance = await getDashboardAppearance();
    assert.equal(appearance.primaryColor, "#F6B900");
    assert.equal(appearance.backgroundStyle, "orbital");
    assert.equal(appearance.interfaceStyle, "command");
  });

  it("allows only the platform administrator to publish settings", async () => {
    const input = {
      primaryColor: "#6EA8FF",
      accentColor: "#B9A7FF",
      backgroundColor: "#050817",
      surfaceColor: "#0C1329",
      textColor: "#F7F8FF",
      mutedColor: "#B7C0D9",
      backgroundStyle: "grid" as const,
      interfaceStyle: "minimal" as const,
    };
    await assert.rejects(
      () => updateDashboardAppearance(ordinaryOwner, input),
      /Platform administrator access required/,
    );
    const saved = await updateDashboardAppearance(platformAdmin, input);
    assert.equal(saved.accentColor, "#B9A7FF");
    assert.equal(saved.backgroundStyle, "grid");
    assert.equal(saved.interfaceStyle, "minimal");
    assert.equal((await getDashboardAppearance()).primaryColor, "#6EA8FF");
  });

  it("restores the complete Elite dashboard default", async () => {
    const reset = await resetDashboardAppearance(platformAdmin);
    assert.equal(reset.primaryColor, "#F6B900");
    assert.equal(reset.accentColor, "#14E6FF");
    assert.equal(reset.backgroundColor, "#020713");
    assert.equal(reset.backgroundStyle, "orbital");
    assert.equal(reset.interfaceStyle, "command");
    await assert.rejects(
      () => resetDashboardAppearance(ordinaryOwner),
      /Platform administrator access required/,
    );
  });
});
