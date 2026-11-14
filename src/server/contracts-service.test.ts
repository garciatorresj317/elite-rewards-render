import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import type pg from "pg";
import type { SessionUser } from "./auth.ts";
import { closeDatabase, setDatabasePoolForTests } from "./database.ts";
import {
  acceptContract,
  createAmendment,
  createContract,
  createPlanTemplate,
  defaultContractInput,
  getPublicContract,
  issueContract,
  listContracts,
  previewContract,
  renderAgreement,
  updateContract,
  voidContract,
} from "./contracts-service.ts";

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
  email: "owner@example.com",
  platformAdmin: false,
};

const issuable = {
  ...defaultContractInput(),
  providerLegalName: "Elite Rewards LLC",
  providerAddress: "100 Provider Way, Orlando, FL 32801",
  providerEmail: "contracts@elite.example",
  providerSignerName: "Jordan Provider",
  providerSignerTitle: "Managing Member",
  clientLegalName: "Example Business LLC",
  clientAddress: "200 Client Road, Orlando, FL 32801",
  clientSignerName: "Alex Owner",
  clientSignerTitle: "Owner",
  clientEmail: "alex@example.com",
  governingLaw: "Florida",
  venue: "Orange County, Florida",
};

let pool: pg.Pool;

describe("service contracts", () => {
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
      CREATE TABLE users(id text PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id));
      CREATE TABLE platform_state(singleton boolean PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id));
      CREATE TABLE audit_events(
        id text PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id),
        actor_user_id text REFERENCES users(id), action text NOT NULL, target_type text NOT NULL,
        target_id text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO businesses(id,name) VALUES ('biz_platform','Elite Rewards'),('biz_client','Example Business');
      INSERT INTO users(id,business_id) VALUES ('usr_platform','biz_platform'),('usr_client','biz_client');
      INSERT INTO platform_state(singleton,business_id) VALUES (true,'biz_platform');
    `);
    const migration = await readFile(
      join(process.cwd(), "migrations", "029_service_contracts.sql"),
      "utf8",
    );
    const pgMemMigration = migration
      .split("CREATE OR REPLACE FUNCTION protect_service_contract_records()")[0]!
      .replace(/ CHECK \(agreement_sha256 IS NULL OR agreement_sha256 ~ '[^']+'\)/g, "")
      // pg-mem does not implement PostgreSQL's integer modulo operator.
      .replace(",\n  CHECK (billing_interval <> 'yearly' OR term_months % 12 = 0)", "")
      .replace(/ CHECK \(token_hash ~ '[^']+'\)/g, "")
      .replace(/ CHECK \(access_code_hash ~ '[^']+'\)/g, "");
    await pool.query(pgMemMigration);
  });

  after(async () => closeDatabase());

  it("ships the requested Custom Plan defaults", () => {
    const draft = defaultContractInput();
    assert.equal(draft.planName, "Custom Plan");
    assert.equal(draft.termMonths, 12);
    assert.equal(draft.billingAmountCents, 6000);
    assert.equal(draft.nfcCardQuantity, 4);
    assert.match(draft.includedServices, /monthly maintenance/i);
    assert.match(draft.upgradeTerms, /upgrade/i);
    assert.equal(draft.autoRenews, false);
    const agreement = renderAgreement(issuable, "ER-TEST");
    assert.match(agreement, /initial-term commitment is \$720\.00/);
    assert.match(agreement, /electronic signature/i);
    assert.match(agreement, /does not renew automatically/i);
    assert.match(agreement, /structured quantities, term, billing cadence/i);
  });

  it("restricts contract administration to platform admins", async () => {
    await assert.rejects(
      () => listContracts(ordinaryOwner),
      /Platform administrator access required/,
    );
    await assert.rejects(
      () => createContract(ordinaryOwner, issuable),
      /Platform administrator access required/,
    );
  });

  it("validates and saves reusable monthly and yearly plan templates", async () => {
    const monthly = await createPlanTemplate(platformAdmin, issuable);
    assert.equal(monthly.billingInterval, "monthly");
    assert.equal(monthly.billingAmountCents, 6000);
    const yearly = await createPlanTemplate(platformAdmin, {
      ...issuable,
      planName: "Annual Custom Plan",
      billingInterval: "yearly",
      billingAmountCents: 72000,
    });
    assert.equal(yearly.billingInterval, "yearly");
    await assert.rejects(
      () =>
        createPlanTemplate(platformAdmin, {
          ...issuable,
          planName: "Invalid Yearly Plan",
          billingInterval: "yearly",
          termMonths: 13,
        }),
      /complete 12-month increments/,
    );
  });

  it("creates, updates, locks, hashes, accepts, and preserves the issued record", async () => {
    const created = await createContract(platformAdmin, issuable);
    assert.equal(created.status, "draft");
    const updated = await updateContract(platformAdmin, created.id, {
      ...issuable,
      additionalTerms: "Approved onboarding begins after the first payment clears.",
    });
    assert.match(updated.additionalTerms, /onboarding/);
    const preview = await previewContract(platformAdmin, created.id);
    assert.equal(preview.contractNumber, created.contractNumber);
    assert.equal(preview.agreementSha256.length, 64);
    assert.match(preview.agreementText, /Approved onboarding/);
    const issued = await issueContract(platformAdmin, created.id, true);
    assert.equal(issued.status, "sent");
    assert.equal(issued.agreementText, preview.agreementText);
    assert.equal(issued.agreementSha256, preview.agreementSha256);
    assert.match(issued.acceptancePath ?? "", /^\/contract\?token=/);
    assert.equal(issued.agreementSha256?.length, 64);
    await assert.rejects(
      () => updateContract(platformAdmin, created.id, issuable),
      /Only a draft contract can be edited/,
    );
    const token = new URL(`https://example.test${issued.acceptancePath}`).searchParams.get(
      "token",
    )!;
    const accessCode = issued.accessCode!;
    const publicRecord = await getPublicContract(token, accessCode);
    assert.equal(publicRecord.agreementSha256, issued.agreementSha256);
    await assert.rejects(() => getPublicContract(token, "BADCODE1"), /access code is incorrect/);
    const accepted = await acceptContract(
      token,
      accessCode,
      {
        signatureName: "Alex Owner",
        signatureTitle: "Owner",
        electronicConsent: true,
      },
      { ip: "203.0.113.7", userAgent: "test browser" },
    );
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.acceptedSignatureName, "Alex Owner");
    assert.equal(accepted.providerSignerName, "Jordan Provider");
    const acceptedRecord = (await listContracts(platformAdmin)).find(
      (contract) => contract.id === created.id,
    );
    assert.equal(acceptedRecord?.acceptedSignatureName, "Alex Owner");
    await assert.rejects(
      () => getPublicContract(token, accessCode),
      /invalid, expired, or already used/,
    );
    await assert.rejects(
      () => voidContract(platformAdmin, created.id),
      /Accepted or missing contracts cannot be voided/,
    );
  });

  it("fails closed when required issue-time party details are missing", async () => {
    const draft = await createContract(platformAdmin, defaultContractInput());
    await assert.rejects(
      () => issueContract(platformAdmin, draft.id, true),
      /Provider legal name is required/,
    );
    const voided = await voidContract(platformAdmin, draft.id);
    assert.equal(voided.status, "void");
  });

  it("renders and accepts an upgrade amendment against the exact parent contract", async () => {
    const initial = await createContract(platformAdmin, {
      ...issuable,
      clientLegalName: "Upgrade Customer LLC",
      clientEmail: "upgrade@example.com",
    });
    const issuedInitial = await issueContract(platformAdmin, initial.id, true);
    const initialToken = new URL(
      `https://example.test${issuedInitial.acceptancePath}`,
    ).searchParams.get("token")!;
    await acceptContract(
      initialToken,
      issuedInitial.accessCode!,
      { signatureName: "Alex Owner", signatureTitle: "Owner", electronicConsent: true },
      { ip: "203.0.113.8", userAgent: "test browser" },
    );

    const amendment = await createAmendment(platformAdmin, initial.id);
    const revised = await updateContract(platformAdmin, amendment.id, {
      ...amendment,
      billingAmountCents: 9000,
      nfcCardQuantity: 8,
      additionalTerms: "Effective on acceptance, the plan includes four additional NFC cards.",
    });
    const preview = await previewContract(platformAdmin, revised.id);
    assert.match(preview.agreementText, /SERVICES AMENDMENT/);
    assert.match(preview.agreementText, new RegExp(initial.contractNumber));
    const issued = await issueContract(platformAdmin, revised.id, true);
    const token = new URL(`https://example.test${issued.acceptancePath}`).searchParams.get(
      "token",
    )!;
    const accepted = await acceptContract(
      token,
      issued.accessCode!,
      { signatureName: "Alex Owner", signatureTitle: "Owner", electronicConsent: true },
      { ip: "203.0.113.9", userAgent: "test browser" },
    );
    assert.equal(accepted.status, "accepted");
    assert.match(accepted.agreementText, new RegExp(initial.contractNumber));
  });
});
