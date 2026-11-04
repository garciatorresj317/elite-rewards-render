import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import { setupProductionProgram } from "./api.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";

const setupToken = "test-setup-token-at-least-24-characters";
let pool: pg.Pool;

describe("one-time production setup", () => {
  before(async () => {
    const memory = newDb({ autoCreateForeignKeyIndices: true });
    memory.public.registerFunction({
      name: "now",
      returns: DataType.timestamptz,
      implementation: () => new Date(),
    });
    memory.public.registerFunction({
      name: "char_length",
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (value: string) => value.length,
    });
    const adapter = memory.adapters.createPg();
    pool = new adapter.Pool() as unknown as pg.Pool;
    setDatabasePoolForTests(pool);
    const sql = await readFile(
      join(process.cwd(), "migrations", "001_production_rewards.sql"),
      "utf8",
    );
    await pool.query(sql);
    process.env["SETUP_TOKEN"] = setupToken;
  });

  after(async () => {
    delete process.env["SETUP_TOKEN"];
    await closeDatabase();
  });

  it("creates only the business, location, owner, rewards, and owner session", async () => {
    const result = await setupProductionProgram({
      setupToken,
      businessName: "Test Elite Program",
      locationName: "Main Store",
      ownerName: "Test Owner",
      ownerEmail: "owner@example.com",
      ownerPassword: "a-secure-owner-password",
      // Legacy member fields must not recreate the removed first-member account.
      memberName: "Legacy Member",
      memberEmail: "legacy-member@example.com",
      memberPassword: "a-secure-member-password",
    });

    assert.ok(result.token);
    assert.ok(result.ownerId);
    assert.deepEqual(Object.keys(result).sort(), ["ownerId", "token"]);

    const roles = await pool.query<{ role: string; count: string }>(
      "SELECT role, count(*) AS count FROM users GROUP BY role ORDER BY role",
    );
    assert.deepEqual(roles.rows, [{ role: "owner", count: 1 }]);
    assert.equal(Number((await pool.query("SELECT count(*) FROM businesses")).rows[0].count), 1);
    assert.equal(Number((await pool.query("SELECT count(*) FROM locations")).rows[0].count), 1);
    assert.equal(Number((await pool.query("SELECT count(*) FROM rewards")).rows[0].count), 3);
    assert.equal(
      Number((await pool.query("SELECT count(*) FROM member_balances")).rows[0].count),
      0,
    );
    assert.equal(Number((await pool.query("SELECT count(*) FROM sessions")).rows[0].count), 1);

    const audit = await pool.query<{ metadata: { locationId: string; memberId?: string } }>(
      "SELECT metadata FROM audit_events WHERE action = 'system.setup'",
    );
    assert.ok(audit.rows[0]?.metadata.locationId);
    assert.equal(audit.rows[0]?.metadata.memberId, undefined);
  });

  it("remains one-time after the owner-only setup completes", async () => {
    await assert.rejects(
      () =>
        setupProductionProgram({
          setupToken,
          businessName: "Second Program",
          locationName: "Second Store",
          ownerName: "Second Owner",
          ownerEmail: "second@example.com",
          ownerPassword: "another-secure-owner-password",
        }),
      /Setup is already complete/,
    );
    assert.equal(Number((await pool.query("SELECT count(*) FROM businesses")).rows[0].count), 1);
    assert.equal(Number((await pool.query("SELECT count(*) FROM users")).rows[0].count), 1);
  });
});
