import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const routes = join(process.cwd(), "src", "routes");

describe("member wallet routing", () => {
  it("routes every customer-facing member-wallet entry through member access", async () => {
    const [clientPage, marketing, joinPage, wallet] = await Promise.all([
      readFile(join(routes, "clients.$clientId.tsx"), "utf8"),
      readFile(join(routes, "index.tsx"), "utf8"),
      readFile(join(routes, "join.tsx"), "utf8"),
      readFile(join(routes, "wallet.tsx"), "utf8"),
    ]);
    assert.equal((clientPage.match(/href="\/login\?access=member"/g) ?? []).length, 2);
    assert.equal((marketing.match(/href="\/login\?access=member"/g) ?? []).length, 2);
    assert.match(joinPage, /href="\/login\?access=member"/);
    assert.match(wallet, /href="\/login\?access=member"/);
  });

  it("keeps member access separate from the business dashboard", async () => {
    const login = await readFile(join(routes, "login.tsx"), "utf8");
    assert.match(login, /search\["access"\] === "member"/);
    assert.match(login, /result\.user\.role !== "member"/);
    assert.match(login, /await api\.logout\(\)/);
    assert.match(login, /Sign out and continue as a member/);
    assert.match(login, /navigate\(\{ to: "\/wallet" \}\)/);
    assert.match(login, /navigate\(\{ to: "\/admin" \}\)/);
  });
});
