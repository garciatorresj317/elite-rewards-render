import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = (...parts: string[]) => readFile(join(process.cwd(), ...parts), "utf8");

describe("contract workspace placement", () => {
  it("adds a platform-only Contracts tab and secure public acceptance page", async () => {
    const [admin, workspace, route, api, migration] = await Promise.all([
      source("src", "routes", "admin.tsx"),
      source("src", "components", "ContractWorkspace.tsx"),
      source("src", "routes", "contract.tsx"),
      source("src", "server", "api.ts"),
      source("migrations", "029_service_contracts.sql"),
    ]);
    assert.match(admin, /id: "Contracts"/);
    assert.match(admin, /active === "Contracts" && user\.platformAdmin/);
    assert.match(admin, /<ContractWorkspace clients=\{clients\} tr=\{tr\}/);
    assert.match(workspace, /Custom Plan/);
    assert.match(workspace, /nfcCardQuantity: 4/);
    assert.match(workspace, /billingAmountCents: 6000/);
    assert.match(workspace, /termMonths: 12/);
    assert.match(workspace, /Provider sign, lock terms, and issue/);
    assert.match(workspace, /Separate access code/);
    assert.match(workspace, /Copy code separately/);
    assert.match(workspace, /Create upgrade amendment/);
    assert.match(workspace, /Preview exact agreement/);
    assert.match(workspace, /Save as reusable plan/);
    assert.match(workspace, /api\.contractPlans\(\)/);
    assert.match(route, /Accept and sign agreement/);
    assert.match(route, /Print or save PDF/);
    assert.match(route, /Enter the separate access code/);
    assert.match(route, /Agreement complete/);
    assert.match(api, /\/api\/contracts\/accept/);
    assert.match(api, /requirePlatformAdmin\(user\)/);
    assert.match(migration, /agreement_sha256/);
    assert.match(migration, /accepted_ip/);
    assert.match(migration, /accepted_user_agent/);
    assert.match(migration, /service_plan_templates/);
    assert.match(migration, /service_contract_events/);
    assert.match(migration, /Issued service contract terms are immutable/);
  });
});
