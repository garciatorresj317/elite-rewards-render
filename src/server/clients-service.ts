import { createHash, randomBytes } from "node:crypto";
import { createSession, hashPassword, newUserId, type SessionUser } from "./auth.ts";
import { getPool, id } from "./database.ts";

const invitationLifetimeHours = 72;

export type ClientSummary = {
  id: string;
  name: string;
  locationName: string;
  ownerName: string;
  ownerEmail: string;
  status: "active" | "invited";
  members: number;
  createdAt: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export type ClientBranding = {
  id: string;
  name: string;
  locationName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

function requirePlatformAdmin(user: SessionUser): void {
  if (!user.platformAdmin) {
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
  }
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getClientInvitation(token: string): Promise<{
  businessName: string;
  locationName: string;
  ownerName: string;
  ownerEmail: string;
}> {
  const result = await getPool().query<{
    business_name: string;
    location_name: string;
    owner_name: string;
    owner_email: string;
  }>(
    `SELECT b.name AS business_name, l.name AS location_name, ci.owner_name, ci.owner_email
       FROM client_invitations ci
       JOIN businesses b ON b.id = ci.business_id
       JOIN locations l ON l.id = ci.location_id
      WHERE ci.token_hash = $1 AND ci.accepted_at IS NULL AND ci.expires_at > now()`,
    [tokenHash(token)],
  );
  const invitation = result.rows[0];
  if (!invitation)
    throw Object.assign(new Error("This client invitation is invalid or expired"), { status: 404 });
  return {
    businessName: invitation.business_name,
    locationName: invitation.location_name,
    ownerName: invitation.owner_name,
    ownerEmail: invitation.owner_email,
  };
}

export async function activateClient(
  token: string,
  password: string,
): Promise<{ sessionToken: string }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      business_id: string;
      location_id: string;
      owner_name: string;
      owner_email: string;
    }>(
      `SELECT id, business_id, location_id, owner_name, owner_email
         FROM client_invitations
        WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > now()
        FOR UPDATE`,
      [tokenHash(token)],
    );
    const invitation = result.rows[0];
    if (!invitation)
      throw Object.assign(new Error("This client invitation is invalid or expired"), {
        status: 404,
      });
    const ownerId = newUserId();
    await client.query(
      `INSERT INTO users(id,business_id,location_id,role,name,email,password_hash)
       VALUES ($1,$2,$3,'owner',$4,$5,$6)`,
      [
        ownerId,
        invitation.business_id,
        invitation.location_id,
        invitation.owner_name,
        invitation.owner_email,
        await hashPassword(password),
      ],
    );
    await client.query("UPDATE client_invitations SET accepted_at = now() WHERE id = $1", [
      invitation.id,
    ]);
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'client.owner.activated','user',$3,'{}')`,
      [id("aud"), invitation.business_id, ownerId],
    );
    const sessionToken = await createSession(client, ownerId);
    await client.query("COMMIT");
    return { sessionToken };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listClients(user: SessionUser): Promise<ClientSummary[]> {
  requirePlatformAdmin(user);
  const database = getPool();
  const businesses = await database.query<{
    id: string;
    name: string;
    created_at: Date;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
  }>(
    `SELECT id, name, created_at, logo_url, primary_color, secondary_color
       FROM businesses
      WHERE id <> (SELECT business_id FROM platform_state WHERE singleton = true)
      ORDER BY created_at, name`,
  );
  const clients: ClientSummary[] = [];
  for (const business of businesses.rows) {
    const [location, owner, invitation, members] = await Promise.all([
      database.query<{ name: string }>(
        "SELECT name FROM locations WHERE business_id = $1 ORDER BY created_at, id LIMIT 1",
        [business.id],
      ),
      database.query<{ id: string; name: string; email: string }>(
        "SELECT id, name, email FROM users WHERE business_id = $1 AND role = 'owner' ORDER BY created_at, id LIMIT 1",
        [business.id],
      ),
      database.query<{ owner_name: string; owner_email: string }>(
        "SELECT owner_name, owner_email FROM client_invitations WHERE business_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1",
        [business.id],
      ),
      database.query<{ count: string }>(
        "SELECT count(*) AS count FROM users WHERE business_id = $1 AND role = 'member' AND active",
        [business.id],
      ),
    ]);
    const businessOwner = owner.rows[0];
    const pendingInvitation = invitation.rows[0];
    clients.push({
      id: business.id,
      name: business.name,
      locationName: location.rows[0]?.name ?? "No location",
      ownerName: businessOwner?.name ?? pendingInvitation?.owner_name ?? "Owner pending",
      ownerEmail: businessOwner?.email ?? pendingInvitation?.owner_email ?? "",
      status: businessOwner ? "active" : "invited",
      members: Number(members.rows[0]?.count ?? 0),
      createdAt: business.created_at.toISOString(),
      logoUrl: business.logo_url,
      primaryColor: business.primary_color,
      secondaryColor: business.secondary_color,
    });
  }
  return clients;
}

export async function createClient(
  user: SessionUser,
  input: { businessName: string; locationName: string; ownerName: string; ownerEmail: string },
): Promise<{ client: ClientSummary; activationPath: string }> {
  requirePlatformAdmin(user);
  const client = await getPool().connect();
  const businessId = id("biz");
  const locationId = id("loc");
  const invitationId = id("inv");
  const invitationToken = randomBytes(32).toString("base64url");
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT 1 FROM users WHERE lower(email) = lower($1)
       UNION ALL
       SELECT 1 FROM client_invitations
        WHERE lower(owner_email) = lower($1) AND accepted_at IS NULL AND expires_at > now()
       LIMIT 1`,
      [input.ownerEmail],
    );
    if (existing.rowCount) {
      throw Object.assign(new Error("An active user or invitation already uses this email"), {
        status: 409,
      });
    }
    await client.query("INSERT INTO businesses(id,name) VALUES ($1,$2)", [
      businessId,
      input.businessName,
    ]);
    await client.query("INSERT INTO locations(id,business_id,name) VALUES ($1,$2,$3)", [
      locationId,
      businessId,
      input.locationName,
    ]);
    await client.query(
      `INSERT INTO client_invitations(id,business_id,location_id,owner_name,owner_email,token_hash,expires_at,created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,now() + interval '${invitationLifetimeHours} hours',$7)`,
      [
        invitationId,
        businessId,
        locationId,
        input.ownerName,
        input.ownerEmail,
        tokenHash(invitationToken),
        user.id,
      ],
    );
    const rewards = [
      [id("rew"), "$5 off", "Take $5 off your next purchase.", 500],
      [id("rew"), "Free favorite", "Choose one eligible item on us.", 850],
      [id("rew"), "$15 reward", "A bigger thank-you for loyal members.", 1200],
    ];
    for (const reward of rewards) {
      await client.query(
        "INSERT INTO rewards(id,business_id,name,description,points_cost) VALUES ($1,$2,$3,$4,$5)",
        [reward[0], businessId, reward[1], reward[2], reward[3]],
      );
    }
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'platform.client.created','business',$2,$4)`,
      [
        id("aud"),
        businessId,
        user.id,
        JSON.stringify({ locationId, ownerEmail: input.ownerEmail }),
      ],
    );
    await client.query("COMMIT");
    return {
      client: {
        id: businessId,
        name: input.businessName,
        locationName: input.locationName,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        status: "invited",
        members: 0,
        createdAt: new Date().toISOString(),
        logoUrl: null,
        primaryColor: "#F6B900",
        secondaryColor: "#FFE27A",
      },
      activationPath: `/activate-client?token=${encodeURIComponent(invitationToken)}`,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getClientBranding(
  user: SessionUser,
  businessId: string,
): Promise<ClientBranding> {
  requirePlatformAdmin(user);
  const result = await getPool().query<{
    id: string;
    name: string;
    location_name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
  }>(
    `SELECT b.id, b.name, COALESCE(l.name, 'Primary location') AS location_name,
            b.logo_url, b.primary_color, b.secondary_color
       FROM businesses b
       LEFT JOIN locations l ON l.business_id = b.id
      WHERE b.id = $1
        AND b.id <> (SELECT business_id FROM platform_state WHERE singleton = true)
      ORDER BY l.created_at, l.id
      LIMIT 1`,
    [businessId],
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("Client not found"), { status: 404 });
  return {
    id: row.id,
    name: row.name,
    locationName: row.location_name,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
  };
}

export async function updateClientBranding(
  user: SessionUser,
  businessId: string,
  input: {
    name: string;
    locationName: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  },
): Promise<ClientBranding> {
  requirePlatformAdmin(user);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const business = await client.query<{ id: string }>(
      `SELECT id FROM businesses
        WHERE id = $1
          AND id <> (SELECT business_id FROM platform_state WHERE singleton = true)
        FOR UPDATE`,
      [businessId],
    );
    if (!business.rowCount) throw Object.assign(new Error("Client not found"), { status: 404 });
    await client.query(
      `UPDATE businesses
          SET name = $2, logo_url = $3, primary_color = $4, secondary_color = $5, updated_at = now()
        WHERE id = $1`,
      [businessId, input.name, input.logoUrl, input.primaryColor, input.secondaryColor],
    );
    const location = await client.query<{ id: string }>(
      "SELECT id FROM locations WHERE business_id = $1 ORDER BY created_at, id LIMIT 1 FOR UPDATE",
      [businessId],
    );
    if (!location.rows[0])
      throw Object.assign(new Error("Client location not found"), { status: 409 });
    await client.query("UPDATE locations SET name = $2 WHERE id = $1", [
      location.rows[0].id,
      input.locationName,
    ]);
    await client.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES ($1,$2,$3,'platform.client.branding.updated','business',$2,$4)`,
      [
        id("aud"),
        businessId,
        user.id,
        JSON.stringify({
          name: input.name,
          locationName: input.locationName,
          logoUrl: input.logoUrl,
          primaryColor: input.primaryColor,
          secondaryColor: input.secondaryColor,
        }),
      ],
    );
    await client.query("COMMIT");
    return await getClientBranding(user, businessId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
