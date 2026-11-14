import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import type { SessionUser } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import {
  createContractPayment,
  listContractPayments,
  listDocumentAudits,
  updateContractPaymentStatus,
} from "./documents-service.ts";

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
  id: "usr_client",
  businessId: "biz_client",
  name: "Client Owner",
  platformAdmin: false,
};

let pool: pg.Pool;

describe("document center", () => {
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
    await pool.query(`
      CREATE TABLE businesses(id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE users(id text PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id), name text NOT NULL);
      CREATE TABLE audit_events(
        id text PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id),
        actor_user_id text REFERENCES users(id), action text NOT NULL, target_type text NOT NULL,
        target_id text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE service_contracts(
        id text PRIMARY KEY, contract_number text NOT NULL UNIQUE,
        linked_business_id text REFERENCES businesses(id), status text NOT NULL
      );
      INSERT INTO businesses(id,name) VALUES ('biz_platform','Elite Rewards'),('biz_client','Example Business');
      INSERT INTO users(id,business_id,name) VALUES ('usr_platform','biz_platform','Platform Owner'),('usr_client','biz_client','Client Owner');
      INSERT INTO service_contracts(id,contract_number,linked_business_id,status)
        VALUES ('ctr_example','ER-2026-000001','biz_client','accepted');
      INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
        VALUES ('aud_example','biz_client','usr_client','reward.created','reward','rew_example','{}');
    `);
    const migration = await readFile(
      join(process.cwd(), "migrations", "030_document_center.sql"),
      "utf8",
    );
    await pool.query(migration);
  });

  after(async () => closeDatabase());

  it("restricts audit and payment records to the platform administrator", async () => {
    await assert.rejects(() => listDocumentAudits(ordinaryOwner), /Platform administrator/);
    await assert.rejects(() => listContractPayments(ordinaryOwner), /Platform administrator/);
  });

  it("returns cross-client audit records with business and actor names", async () => {
    const events = await listDocumentAudits(platformAdmin);
    assert.equal(events[0]?.businessName, "Example Business");
    assert.equal(events[0]?.actorName, "Client Owner");
    assert.equal(events[0]?.action, "reward.created");
  });

  it("creates linked payments and maintains paid-at status integrity", async () => {
    const created = await createContractPayment(platformAdmin, {
      serviceContractId: "ctr_example",
      linkedBusinessId: "biz_client",
      clientName: "Example Business LLC",
      description: "Monthly Elite Rewards service",
      amountCents: 6000,
      dueDate: "2026-12-01",
      status: "scheduled",
      paymentMethod: "ACH",
      reference: "INV-1001",
      notes: "First contract installment",
    });
    assert.equal(created.contractNumber, "ER-2026-000001");
    assert.equal(created.status, "scheduled");
    assert.equal(created.paidAt, null);

    const paid = await updateContractPaymentStatus(platformAdmin, created.id, "paid");
    assert.equal(paid.status, "paid");
    assert.ok(paid.paidAt);
    assert.equal((await listContractPayments(platformAdmin))[0]?.reference, "INV-1001");

    const voided = await updateContractPaymentStatus(platformAdmin, created.id, "void");
    assert.equal(voided.status, "void");
    assert.equal(voided.paidAt, null);
    const audit = await pool.query<{ action: string }>(
      "SELECT action FROM audit_events WHERE target_id=$1 ORDER BY created_at DESC",
      [created.id],
    );
    assert.ok(audit.rows.some((row) => row.action === "platform.payment.created"));
    assert.ok(audit.rows.some((row) => row.action === "platform.payment.status.updated"));
  });

  it("derives the payment client from a linked contract and rejects a conflicting client", async () => {
    const derived = await createContractPayment(platformAdmin, {
      serviceContractId: "ctr_example",
      linkedBusinessId: null,
      clientName: "Example Business LLC",
      description: "Contract-derived installment",
      amountCents: 6000,
      dueDate: "2027-01-01",
      status: "due",
      paymentMethod: "",
      reference: "INV-1002",
      notes: "",
    });
    assert.equal(derived.linkedBusinessId, "biz_client");
    const audit = await pool.query<{ business_id: string }>(
      "SELECT business_id FROM audit_events WHERE target_id=$1",
      [derived.id],
    );
    assert.equal(audit.rows[0]?.business_id, "biz_client");

    await assert.rejects(
      () =>
        createContractPayment(platformAdmin, {
          serviceContractId: "ctr_example",
          linkedBusinessId: "biz_platform",
          clientName: "Wrong Business",
          description: "Conflicting payment",
          amountCents: 6000,
          dueDate: "2027-02-01",
          status: "scheduled",
          paymentMethod: "",
          reference: "",
          notes: "",
        }),
      /does not match/,
    );
  });
});
