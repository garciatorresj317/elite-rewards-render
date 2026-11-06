import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = (...parts: string[]) => readFile(join(process.cwd(), "src", ...parts), "utf8");

describe("English and Spanish localization coverage", () => {
  it("mounts one persistent language control above every routed page", async () => {
    const [root, i18n] = await Promise.all([
      source("routes", "__root.tsx"),
      source("i18n", "index.tsx"),
    ]);

    assert.match(root, /<I18nProvider>/);
    assert.match(root, /<LanguageSwitcher\s*\/>/);
    assert.ok(root.indexOf("<LanguageSwitcher") < root.indexOf("<Outlet"));
    assert.match(i18n, /elite-rewards-locale/);
    assert.match(i18n, /localStorage\.setItem\(STORAGE_KEY, next\)/);
    assert.match(i18n, /document\.documentElement\.lang = locale/);
    assert.match(i18n, /English/);
    assert.match(i18n, /Español/);
  });

  it("localizes every public, authentication, client, member, and admin route", async () => {
    const routes = [
      "index.tsx",
      "login.tsx",
      "setup.tsx",
      "activate-client.tsx",
      "activate-member.tsx",
      "join.tsx",
      "clients.$clientId.tsx",
      "wallet.tsx",
      "admin.tsx",
    ];

    for (const route of routes) {
      const file = await source("routes", route);
      assert.match(file, /useI18n/, `${route} must use the shared localization provider`);
    }
  });

  it("keeps tenant-authored fields out of the fixed translation dictionary", async () => {
    const i18n = await source("i18n", "index.tsx");
    assert.doesNotMatch(i18n, /Big Smoke/);
    assert.doesNotMatch(i18n, /Mike D/);
  });

  it("keeps the global language control visible and responsive", async () => {
    const styles = await source("styles.css");
    assert.match(styles, /\.language-switcher/);
    assert.match(styles, /position:\s*fixed/);
    assert.match(styles, /\[aria-pressed="true"\]/);
  });
});
