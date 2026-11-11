import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const routes = join(process.cwd(), "src", "routes");

describe("member wallet routing", () => {
  it("routes customer-program member-wallet entries through member access without adding sign-in tabs to marketing", async () => {
    const [clientPage, marketing, joinPage, wallet] = await Promise.all([
      readFile(join(routes, "clients.$clientId.tsx"), "utf8"),
      readFile(join(routes, "index.tsx"), "utf8"),
      readFile(join(routes, "join.tsx"), "utf8"),
      readFile(join(routes, "wallet.tsx"), "utf8"),
    ]);
    assert.equal((clientPage.match(/href="\/login\?access=member"/g) ?? []).length, 2);
    assert.equal((marketing.match(/href="\/login\?access=member"/g) ?? []).length, 0);
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

  it("keeps member intent through password recovery", async () => {
    const [login, forgot, reset, service] = await Promise.all([
      readFile(join(routes, "login.tsx"), "utf8"),
      readFile(join(routes, "forgot-password.tsx"), "utf8"),
      readFile(join(routes, "reset-password.tsx"), "utf8"),
      readFile(join(process.cwd(), "src", "server", "password-reset-service.ts"), "utf8"),
    ]);
    assert.match(login, /to="\/forgot-password"[\s\S]*?access: "member"/);
    assert.match(forgot, /search\["access"\] === "member"/);
    assert.match(reset, /access === "member"/);
    assert.match(service, /pending\.role === "member" \? "&access=member"/);
  });
});
