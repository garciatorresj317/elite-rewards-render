import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import sharp from "sharp";
import { CLIENT_LOGO_MAX_BYTES } from "../lib/upload-limits.ts";
import { authenticate, getSessionUser, type SessionUser } from "./auth.ts";
import {
  activateClient,
  createClient,
  getClientBranding,
  getClientInvitation,
  getClientLogo,
  getPublicClientExperience,
  listClients,
  setClientActive,
  resetClientBranding,
  updateClientBranding,
  updateClientLogo,
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
    memory.public.registerFunction({
      name: "octet_length",
      args: [DataType.bytea],
      returns: DataType.integer,
      implementation: (value: Buffer) => value.length,
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
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "003_member_enrollment.sql"), "utf8"),
    );
    await pool.query(
      await readFile(
        join(process.cwd(), "migrations", "004_referrals_and_visual_themes.sql"),
        "utf8",
      ),
    );
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "005_automatic_holiday_themes.sql"), "utf8"),
    );
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "006_editable_rewards.sql"), "utf8"),
    );
    await pool.query(
      await readFile(
        join(process.cwd(), "migrations", "009_public_enrollment_and_products.sql"),
        "utf8",
      ),
    );
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "010_client_suspension.sql"), "utf8"),
    );
    await pool.query(
      await readFile(
        join(process.cwd(), "migrations", "011_product_images_and_points.sql"),
        "utf8",
      ),
    );
    await pool.query("UPDATE users SET platform_admin = false WHERE id = 'usr_ordinary'");
    await pool.query("ALTER TABLE businesses ADD COLUMN logo_url text");
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN primary_color text NOT NULL DEFAULT '#F6B900'",
    );
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN secondary_color text NOT NULL DEFAULT '#FFE27A'",
    );
    await pool.query(
      "ALTER TABLE businesses ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()",
    );
    await pool.query("ALTER TABLE businesses ADD COLUMN logo_data bytea");
    await pool.query("ALTER TABLE businesses ADD COLUMN logo_mime text");
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "012_client_logo_10mb.sql"), "utf8"),
    );
    await pool.query(
      (
        await readFile(
          join(process.cwd(), "migrations", "019_high_resolution_uploaded_images.sql"),
          "utf8",
        )
      ).replaceAll(" NOT VALID", ""),
    );
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "020_points_per_dollar.sql"), "utf8"),
    );
    await pool.query(
      await readFile(
        join(process.cwd(), "migrations", "021_full_client_experience_customization.sql"),
        "utf8",
      ),
    );
    await pool.query(
      await readFile(join(process.cwd(), "migrations", "022_business_name_color.sql"), "utf8"),
    );
    await pool.query(
      "CREATE TABLE platform_administrator(singleton boolean PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES users(id))",
    );
    await pool.query(
      "INSERT INTO platform_administrator(singleton,user_id) VALUES (true,'usr_platform')",
    );
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
    assert.equal(clients.length, 1);
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

  it("lets the sole platform administrator brand a client without exposing the platform tenant", async () => {
    const clients = await listClients(platformOwner);
    assert.equal(
      clients.some((client) => client.id === platformOwner.businessId),
      false,
    );
    const client = clients.find((item) => item.name === "First Client");
    assert.ok(client);
    const saved = await updateClientBranding(platformOwner, client.id, {
      name: "Big Smoke",
      locationName: "Big Smoke Main",
      primaryColor: "#112233",
      secondaryColor: "#DDAA33",
    });
    assert.equal(saved.name, "Big Smoke");
    assert.equal(saved.previewPath, `/clients/${client.id}`);
    assert.equal(saved.nfcPath, saved.previewPath);
    assert.equal((await getClientBranding(platformOwner, client.id)).primaryColor, "#112233");
    await assert.rejects(
      () => getClientBranding(ordinaryOwner, client.id),
      /Platform administrator access required/,
    );
    await assert.rejects(
      () => getClientBranding(platformOwner, platformOwner.businessId),
      /Client not found/,
    );
  });

  it("stores validated file-uploaded logos and exposes the branded NFC destination", async () => {
    const client = (await listClients(platformOwner)).find((item) => item.name === "Big Smoke");
    assert.ok(client);
    const webp = await sharp({
      create: { width: 400, height: 200, channels: 4, background: "#F6B900" },
    })
      .webp()
      .toBuffer();
    const saved = await updateClientLogo(platformOwner, client.id, {
      mime: "image/webp",
      data: webp,
    });
    assert.match(saved.logoUrl ?? "", new RegExp(`^/api/public/clients/${client.id}/logo\\?v=`));
    const storedLogo = await getClientLogo(client.id);
    assert.equal(storedLogo?.mime, "image/webp");
    const storedDimensions = await pool.query<{
      logo_width: number;
      logo_height: number;
      logo_processing_version: number;
    }>("SELECT logo_width,logo_height,logo_processing_version FROM businesses WHERE id=$1", [
      client.id,
    ]);
    assert.deepEqual(storedDimensions.rows[0], {
      logo_width: 2048,
      logo_height: 1024,
      logo_processing_version: 1,
    });
    const png = await sharp({
      create: { width: 64, height: 64, channels: 4, background: "#FFFFFF" },
    })
      .png()
      .toBuffer();
    const publicPage = await getPublicClientExperience(client.id);
    assert.equal(publicPage.business.business_name, "Big Smoke");
    assert.equal(publicPage.business.logo_url, saved.logoUrl);
    assert.equal(publicPage.rewards.length, 3);
    assert.equal(publicPage.visualSettings.automaticThemeActive, false);
    assert.equal("automaticHolidayThemes" in publicPage.visualSettings, false);
    assert.equal("timeZone" in publicPage.visualSettings, false);
    assert.equal("configuredThemeKey" in publicPage.visualSettings, false);
    await assert.rejects(
      () =>
        updateClientLogo(platformOwner, platformOwner.businessId, {
          mime: "image/webp",
          data: webp,
        }),
      /Client not found/,
    );
    await assert.rejects(
      () => updateClientLogo(ordinaryOwner, client.id, { mime: "image/png", data: png }),
      /Platform administrator access required/,
    );
    await assert.rejects(
      () =>
        updateClientLogo(platformOwner, client.id, {
          mime: "image/png",
          data: Buffer.from("not an image"),
        }),
      /does not match/,
    );

    const largerThanTwoMegabytes = await sharp({
      create: { width: 1200, height: 1200, channels: 4, background: "#66ABF0" },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    await updateClientLogo(platformOwner, client.id, {
      mime: "image/png",
      data: largerThanTwoMegabytes,
    });
    assert.equal((await getClientLogo(client.id))?.mime, "image/webp");

    const secondWebp = await sharp({
      create: { width: 320, height: 640, channels: 4, background: "#11FF88" },
    })
      .webp()
      .toBuffer();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replaced = await updateClientLogo(platformOwner, client.id, {
      mime: "image/webp",
      data: secondWebp,
    });
    assert.notEqual(replaced.logoUrl, saved.logoUrl);
    const replacement = await getClientLogo(client.id);
    assert.equal(replacement?.mime, "image/webp");
    const replacementDimensions = await pool.query<{
      logo_width: number;
      logo_height: number;
      logo_processing_version: number;
    }>("SELECT logo_width,logo_height,logo_processing_version FROM businesses WHERE id=$1", [
      client.id,
    ]);
    assert.deepEqual(replacementDimensions.rows[0], {
      logo_width: 1024,
      logo_height: 2048,
      logo_processing_version: 1,
    });

    const largerThanTenMegabytes = Buffer.alloc(CLIENT_LOGO_MAX_BYTES + 1, 0x20);
    Buffer.from("RIFF0000WEBP", "ascii").copy(largerThanTenMegabytes);
    await assert.rejects(
      () =>
        updateClientLogo(platformOwner, client.id, {
          mime: "image/webp",
          data: largerThanTenMegabytes,
        }),
      /Logo must be 10 MB or smaller/,
    );
  });

  it("returns only logo and colors to the Elite defaults while preserving client data", async () => {
    const client = (await listClients(platformOwner)).find((item) => item.name === "Big Smoke");
    assert.ok(client);
    await updateClientBranding(platformOwner, client.id, {
      name: "Big Smoke",
      locationName: "Big Smoke Main",
      primaryColor: "#123456",
      secondaryColor: "#ABCDEF",
    });
    const before = await pool.query<{ rewards: string; users: string }>(
      `SELECT
         (SELECT count(*) FROM rewards WHERE business_id = $1) AS rewards,
         (SELECT count(*) FROM users WHERE business_id = $1) AS users`,
      [client.id],
    );
    const reset = await resetClientBranding(platformOwner, client.id);
    assert.equal(reset.name, "Big Smoke");
    assert.equal(reset.locationName, "Big Smoke Main");
    assert.equal(reset.logoUrl, null);
    assert.equal(reset.primaryColor, "#F6B900");
    assert.equal(reset.secondaryColor, "#FFE27A");
    assert.equal(await getClientLogo(client.id), null);
    const after = await pool.query<{ rewards: string; users: string }>(
      `SELECT
         (SELECT count(*) FROM rewards WHERE business_id = $1) AS rewards,
         (SELECT count(*) FROM users WHERE business_id = $1) AS users`,
      [client.id],
    );
    assert.deepEqual(after.rows[0], before.rows[0]);
    await assert.rejects(
      () => resetClientBranding(ordinaryOwner, client.id),
      /Platform administrator access required/,
    );
    await assert.rejects(
      () => resetClientBranding(platformOwner, platformOwner.businessId),
      /Client not found/,
    );
  });

  it("lets only the platform administrator suspend and reactivate a client without deleting data", async () => {
    const client = (await listClients(platformOwner)).find((item) => item.name === "Big Smoke");
    assert.ok(client);
    const login = await authenticate("client@example.com", "client-owner-secure-password");
    assert.ok(login);
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) SELECT 'client-session',id,now() + interval '7 days' FROM users WHERE business_id = $1 LIMIT 1",
      [client.id],
    );
    await assert.rejects(
      () => setClientActive(ordinaryOwner, client.id, false),
      /Platform administrator access required/,
    );
    await assert.rejects(
      () => setClientActive(platformOwner, platformOwner.businessId, false),
      /Client not found/,
    );
    const suspended = await setClientActive(platformOwner, client.id, false);
    assert.equal(suspended.status, "suspended");
    assert.equal(await authenticate("client@example.com", "client-owner-secure-password"), null);
    assert.equal(
      await getSessionUser(
        new Request("https://elite.test/api/auth/session", {
          headers: { cookie: `elite_session=${login.token}` },
        }),
      ),
      null,
    );
    const sessions = await pool.query<{ count: string }>(
      "SELECT count(*) FROM sessions WHERE user_id IN (SELECT id FROM users WHERE business_id = $1)",
      [client.id],
    );
    assert.equal(Number(sessions.rows[0]?.count), 0);
    const rewards = await pool.query<{ count: string }>(
      "SELECT count(*) FROM rewards WHERE business_id = $1",
      [client.id],
    );
    assert.equal(Number(rewards.rows[0]?.count), 3);
    await assert.rejects(() => getPublicClientExperience(client.id), /Client not found/);
    const audit = await pool.query<{ action: string }>(
      "SELECT action FROM audit_events WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1",
      [client.id],
    );
    assert.equal(audit.rows[0]?.action, "platform.client.suspended");
    await pool.query(
      `INSERT INTO sessions(token_hash,user_id,expires_at,business_access_version)
       SELECT $1,id,now() + interval '7 days',1 FROM users WHERE business_id = $2 LIMIT 1`,
      [createHash("sha256").update(login.token).digest("hex"), client.id],
    );
    const activated = await setClientActive(platformOwner, client.id, true);
    assert.equal(activated.status, "active");
    assert.equal(
      await getSessionUser(
        new Request("https://elite.test/api/auth/session", {
          headers: { cookie: `elite_session=${login.token}` },
        }),
      ),
      null,
    );
    assert.ok(await authenticate("client@example.com", "client-owner-secure-password"));
    assert.equal((await getPublicClientExperience(client.id)).business.business_name, "Big Smoke");
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
