import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) => readFile(join(root, path), "utf8");

describe("Holiday live-theme surface coverage", () => {
  it("renders the business theme on every tenant rewards surface", async () => {
    const [admin, wallet, clientPage, join, memberActivation, clientActivation] = await Promise.all(
      [
        read("src/routes/admin.tsx"),
        read("src/routes/wallet.tsx"),
        read("src/routes/clients.$clientId.tsx"),
        read("src/routes/join.tsx"),
        read("src/routes/activate-member.tsx"),
        read("src/routes/activate-client.tsx"),
      ],
    );
    for (const source of [admin, wallet, clientPage, join, memberActivation, clientActivation]) {
      assert.match(source, /ExperienceBackdrop/);
    }
    assert.match(clientPage, /data\.visualSettings/);
    assert.match(join, /businessContext\?\.visualSettings/);
  });

  it("uses separate high-resolution live artwork for every automatic holiday", async () => {
    const catalog = await read("src/lib/theme-catalog.ts");
    for (const key of ["mlk-day", "remembrance-911", "winter-holiday", "spring-celebration"]) {
      assert.match(catalog, new RegExp(`${key}-live\\.jpg`));
    }
  });

  it("keeps automatic controls exclusively in authenticated Elite client management", async () => {
    const admin = await read("src/routes/admin.tsx");
    const routes = ["wallet.tsx", "clients.$clientId.tsx", "join.tsx"];
    assert.match(admin, /Client appearance/);
    assert.match(admin, /automatic-theme-toggle/);
    assert.match(admin, /updateClientVisualSettings/);
    assert.doesNotMatch(admin, /updateVisualSettings\(visualDraft\)/);
    for (const route of routes) {
      assert.doesNotMatch(
        await read(`src/routes/${route}`),
        /Publish holiday settings|automatic-theme-toggle/,
      );
    }
  });
});
