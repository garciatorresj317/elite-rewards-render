import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import type { SessionUser } from "./auth.ts";
import {
  activateClient,
  createClient,
  getClientInvitation,
  listClients,
} from "./clients-service.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";

const platformOwner: SessionUser = {
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
  ...platformOwner,
  id: "usr_ordinary",
  email: "ordinary@example.com",
  platformAdmin: false,
};

let pool: pg.Pool;

describe("platform client management", () => {
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
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "001_production_rewards.sql"), "utf8"),
    );
    await pool.query("INSERT INTO businesses(id,name) VALUES ('biz_platform','Elite Rewards')");
    await pool.query(
      "INSERT INTO platform_state(singleton,business_id) VALUES (true,'biz_platform')",
    );
    await pool.query(
      "INSERT INTO locations(id,business_id,name) VALUES ('loc_platform','biz_platform','Platform Office')",
    );
    await pool.query(
      `INSERT INTO users(id,business_id,location_id,role,name,email,password_hash)
       VALUES ('usr_platform','biz_platform','loc_platform','owner','Platform Owner','platform@example.com','test'),
              ('usr_ordinary','biz_platform','loc_platform','owner','Ordinary Owner','ordinary@example.com','test')`,
    );
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "002_platform_clients.sql"), "utf8"),
    );
    await pool.query("UPDATE users SET platform_admin = false WHERE id = 'usr_ordinary'");
  });

  after(async () => {
    await closeDatabase();
  });

  it("allows only the platform administrator to create and list isolated clients", async () => {
    await assert.rejects(
      () =>
        createClient(ordinaryOwner, {
          businessName: "Denied Client",
          locationName: "Denied Store",
          ownerName: "Denied Owner",
          ownerEmail: "denied@example.com",
        }),
      /Platform administrator access required/,
    );

    const result = await createClient(platformOwner, {
      businessName: "First Client",
      locationName: "Main Store",
      ownerName: "Client Owner",
      ownerEmail: "client@example.com",
    });
    assert.equal(result.client.status, "invited");
    assert.match(result.activationPath, /^\/activate-client\?token=/);
    const invitationToken = new URL(`https://elite.test${result.activationPath}`).searchParams.get(
      "token",
    );
    assert.ok(invitationToken);
    const invitation = await getClientInvitation(invitationToken);
    assert.equal(invitation.businessName, "First Client");

    const clients = await listClients(platformOwner);
    assert.equal(clients.length, 2);
    const created = clients.find((client) => client.id === result.client.id);
    assert.equal(created?.name, "First Client");
    assert.equal(created?.ownerEmail, "client@example.com");
    assert.equal(created?.status, "invited");

    const clientRewards = await pool.query<{ count: string }>(
      "SELECT count(*) FROM rewards WHERE business_id = $1",
      [result.client.id],
    );
    assert.equal(Number(clientRewards.rows[0]?.count), 3);
    assert.equal(
      Number(
        (await pool.query("SELECT count(*) FROM users WHERE business_id = $1", [result.client.id]))
          .rows[0].count,
      ),
      0,
    );

    const activated = await activateClient(invitationToken, "client-owner-secure-password");
    assert.ok(activated.sessionToken);
    const activatedOwner = await pool.query<{ platform_admin: boolean }>(
      "SELECT platform_admin FROM users WHERE business_id = $1 AND role = 'owner'",
      [result.client.id],
    );
    assert.equal(activatedOwner.rows[0]?.platform_admin, false);
    await assert.rejects(
      () => activateClient(invitationToken, "client-owner-secure-password"),
      /invalid or expired/,
    );
  });

  it("rejects a duplicate pending owner email", async () => {
    await assert.rejects(
      () =>
        createClient(platformOwner, {
          businessName: "Duplicate Client",
          locationName: "Main Store",
          ownerName: "Duplicate Owner",
          ownerEmail: "client@example.com",
        }),
      /already uses this email/,
    );
  });
});
