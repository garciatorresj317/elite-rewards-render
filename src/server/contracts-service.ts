import { createHash, randomBytes } from "node:crypto";
import type { SessionUser } from "./auth.ts";
import { getPool, id } from "./database.ts";

export const contractBillingIntervals = ["monthly", "yearly"] as const;
export type ContractBillingInterval = (typeof contractBillingIntervals)[number];
export type ContractStatus = "draft" | "sent" | "accepted" | "void";
export type AgreementType = "initial" | "amendment" | "renewal";

export type ContractInput = {
  linkedBusinessId: string | null;
  planTemplateId: string | null;
  providerLegalName: string;
  providerAddress: string;
  providerEmail: string;
  providerSignerName: string;
  providerSignerTitle: string;
  clientLegalName: string;
  clientAddress: string;
  clientSignerName: string;
  clientSignerTitle: string;
  clientEmail: string;
  planName: string;
  billingInterval: ContractBillingInterval;
  billingAmountCents: number;
  termMonths: number;
  nfcCardQuantity: number;
  includedServices: string;
  paymentTerms: string;
  upgradeTerms: string;
  terminationTerms: string;
  additionalTerms: string;
  autoRenews: boolean;
  governingLaw: string;
  venue: string;
  effectiveDate: string | null;
};

export type ServicePlanTemplate = Pick<
  ContractInput,
  | "planName"
  | "billingInterval"
  | "billingAmountCents"
  | "termMonths"
  | "nfcCardQuantity"
  | "includedServices"
  | "paymentTerms"
  | "upgradeTerms"
  | "terminationTerms"
  | "autoRenews"
> & { id: string; version: number; active: boolean; createdAt: string; updatedAt: string };

export type ServiceContract = ContractInput & {
  id: string;
  contractNumber: string;
  agreementType: AgreementType;
  parentContractId: string | null;
  planTemplateVersion: number | null;
  status: ContractStatus;
  providerSignedAt: string | null;
  agreementText: string | null;
  agreementSha256: string | null;
  acceptancePath: string | null;
  accessCode: string | null;
  acceptanceExpiresAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  acceptedSignatureName: string | null;
  acceptedSignatureTitle: string | null;
  acceptedEmail: string | null;
  electronicConsent: boolean;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicContract = {
  contractNumber: string;
  providerLegalName: string;
  providerSignerName: string;
  providerSignerTitle: string;
  providerSignedAt: string;
  clientLegalName: string;
  agreementText: string;
  agreementSha256: string;
  acceptanceExpiresAt: string;
  status: "sent" | "accepted";
  acceptedSignatureName: string | null;
  acceptedSignatureTitle: string | null;
  acceptedAt: string | null;
};

export type ContractPreview = Pick<
  PublicContract,
  "contractNumber" | "providerLegalName" | "clientLegalName" | "agreementText" | "agreementSha256"
>;

type ContractRow = {
  id: string;
  contract_number: string;
  agreement_type: AgreementType;
  parent_contract_id: string | null;
  linked_business_id: string | null;
  plan_template_id: string | null;
  plan_template_version: number | null;
  status: ContractStatus;
  provider_legal_name: string;
  provider_address: string;
  provider_email: string;
  provider_signer_name: string;
  provider_signer_title: string;
  provider_signed_at: string | Date | null;
  client_legal_name: string;
  client_address: string;
  client_signer_name: string;
  client_signer_title: string;
  client_email: string;
  plan_name: string;
  billing_interval: ContractBillingInterval;
  billing_amount_cents: number;
  term_months: number;
  nfc_card_quantity: number;
  included_services: string;
  payment_terms: string;
  upgrade_terms: string;
  termination_terms: string;
  additional_terms: string;
  auto_renews: boolean;
  governing_law: string;
  venue: string;
  effective_date: string | Date | null;
  agreement_text: string | null;
  agreement_sha256: string | null;
  sent_at: string | Date | null;
  accepted_at: string | Date | null;
  accepted_signature_name: string | null;
  accepted_signature_title: string | null;
  accepted_email: string | null;
  electronic_consent: boolean;
  voided_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  acceptance_expires_at?: string | Date | null;
};

type PlanRow = {
  id: string;
  name: string;
  version: number;
  active: boolean;
  billing_interval: ContractBillingInterval;
  billing_amount_cents: number;
  term_months: number;
  nfc_card_quantity: number;
  included_services: string;
  payment_terms: string;
  upgrade_terms: string;
  termination_terms: string;
  auto_renews: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

const contractSelect = `c.id, c.contract_number, c.agreement_type, c.parent_contract_id,
  c.linked_business_id, c.plan_template_id, c.plan_template_version, c.status,
  c.provider_legal_name, c.provider_address, c.provider_email, c.provider_signer_name,
  c.provider_signer_title, c.provider_signed_at, c.client_legal_name, c.client_address,
  c.client_signer_name, c.client_signer_title, c.client_email, c.plan_name,
  c.billing_interval, c.billing_amount_cents, c.term_months, c.nfc_card_quantity,
  c.included_services, c.payment_terms, c.upgrade_terms, c.termination_terms,
  c.additional_terms, c.auto_renews, c.governing_law, c.venue, c.effective_date,
  c.agreement_text, c.agreement_sha256, c.sent_at, c.accepted_at,
  c.accepted_signature_name, c.accepted_signature_title, c.accepted_email,
  c.electronic_consent, c.voided_at, c.created_at, c.updated_at,
  (SELECT t.expires_at FROM service_contract_tokens t WHERE t.contract_id=c.id
    AND t.consumed_at IS NULL AND t.revoked_at IS NULL ORDER BY t.created_at DESC LIMIT 1)
    AS acceptance_expires_at`;

function requirePlatformAdmin(user: SessionUser): void {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
}
function iso(value: string | Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}
function dateOnly(value: string | Date | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}
function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
function nextContractNumber(): string {
  const now = new Date();
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `ER-${date}-${randomBytes(8).toString("hex").toUpperCase()}`;
}
function rowToPlan(row: PlanRow): ServicePlanTemplate {
  return {
    id: row.id,
    planName: row.name,
    version: Number(row.version),
    active: row.active,
    billingInterval: row.billing_interval,
    billingAmountCents: Number(row.billing_amount_cents),
    termMonths: Number(row.term_months),
    nfcCardQuantity: Number(row.nfc_card_quantity),
    includedServices: row.included_services,
    paymentTerms: row.payment_terms,
    upgradeTerms: row.upgrade_terms,
    terminationTerms: row.termination_terms,
    autoRenews: row.auto_renews,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
function rowToContract(
  row: ContractRow,
  credentials?: { token: string; accessCode: string },
): ServiceContract {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    agreementType: row.agreement_type,
    parentContractId: row.parent_contract_id,
    linkedBusinessId: row.linked_business_id,
    planTemplateId: row.plan_template_id,
    planTemplateVersion: row.plan_template_version,
    status: row.status,
    providerLegalName: row.provider_legal_name,
    providerAddress: row.provider_address,
    providerEmail: row.provider_email,
    providerSignerName: row.provider_signer_name,
    providerSignerTitle: row.provider_signer_title,
    providerSignedAt: iso(row.provider_signed_at),
    clientLegalName: row.client_legal_name,
    clientAddress: row.client_address,
    clientSignerName: row.client_signer_name,
    clientSignerTitle: row.client_signer_title,
    clientEmail: row.client_email,
    planName: row.plan_name,
    billingInterval: row.billing_interval,
    billingAmountCents: Number(row.billing_amount_cents),
    termMonths: Number(row.term_months),
    nfcCardQuantity: Number(row.nfc_card_quantity),
    includedServices: row.included_services,
    paymentTerms: row.payment_terms,
    upgradeTerms: row.upgrade_terms,
    terminationTerms: row.termination_terms,
    additionalTerms: row.additional_terms,
    autoRenews: row.auto_renews,
    governingLaw: row.governing_law,
    venue: row.venue,
    effectiveDate: dateOnly(row.effective_date),
    agreementText: row.agreement_text,
    agreementSha256: row.agreement_sha256,
    acceptancePath: credentials ? `/contract?token=${encodeURIComponent(credentials.token)}` : null,
    accessCode: credentials?.accessCode ?? null,
    acceptanceExpiresAt: iso(row.acceptance_expires_at),
    sentAt: iso(row.sent_at),
    acceptedAt: iso(row.accepted_at),
    acceptedSignatureName: row.accepted_signature_name,
    acceptedSignatureTitle: row.accepted_signature_title,
    acceptedEmail: row.accepted_email,
    electronicConsent: row.electronic_consent,
    voidedAt: iso(row.voided_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

export function defaultContractInput(): ContractInput {
  return {
    linkedBusinessId: null,
    planTemplateId: "plan_custom_v1",
    providerLegalName: "",
    providerAddress: "",
    providerEmail: "",
    providerSignerName: "",
    providerSignerTitle: "",
    clientLegalName: "",
    clientAddress: "",
    clientSignerName: "",
    clientSignerTitle: "",
    clientEmail: "",
    planName: "Custom Plan",
    billingInterval: "monthly",
    billingAmountCents: 6000,
    termMonths: 12,
    nfcCardQuantity: 4,
    includedServices:
      "Four programmed NFC cards; Elite Rewards program access; initial custom configuration; monthly maintenance; reasonable technical support; and routine service updates during the term.",
    paymentTerms:
      "The first payment is due on the Effective Date and each later payment is due on the same calendar day of each following billing period. Amounts more than 10 days late may result in service suspension after written notice. Payment obligations accrued before suspension or termination remain due.",
    upgradeTerms:
      "Client may request an upgrade at any time. An upgrade becomes effective only through a written amendment or replacement order accepted by both parties. Any added fees, services, equipment, and changed term will be stated in that amendment; no downgrade or upgrade cancels amounts already due unless the amendment expressly says so.",
    terminationTerms:
      "This Agreement is a fixed-term commitment. Either party may terminate for a material breach that remains uncured 15 days after written notice. Client remains responsible for charges accrued through the termination date and, except where Provider materially breaches, the unpaid balance of the committed term. Sections concerning payment, confidentiality, intellectual property, warranty limitations, liability, disputes, and records survive termination.",
    additionalTerms: "",
    autoRenews: false,
    governingLaw: "",
    venue: "",
    effectiveDate: null,
  };
}

export function contractCommitment(input: ContractInput): { installments: number; cents: number } {
  if (input.billingInterval === "yearly" && input.termMonths % 12 !== 0)
    throw Object.assign(
      new Error("Yearly billing requires a term in complete 12-month increments"),
      { status: 400 },
    );
  const installments =
    input.billingInterval === "monthly" ? input.termMonths : input.termMonths / 12;
  return { installments, cents: input.billingAmountCents * installments };
}

export function renderAgreement(
  input: ContractInput,
  contractNumber: string,
  agreementType: AgreementType = "initial",
  parentContractNumber?: string,
): string {
  const cadence = input.billingInterval === "monthly" ? "month" : "year";
  const { installments, cents } = contractCommitment(input);
  const effectiveDate = input.effectiveDate ?? "the date of the Client’s electronic signature";
  const renewal = input.autoRenews
    ? "After the initial term, this Agreement renews for successive periods matching the billing interval until either party gives at least 30 days’ written notice, subject to any mandatory renewal notice law."
    : "This Agreement does not renew automatically. Continued service after the initial term requires a new written agreement or amendment accepted by both parties.";
  const heading =
    agreementType === "amendment"
      ? "ELITE REWARDS SERVICES AMENDMENT"
      : "ELITE REWARDS SERVICES AGREEMENT";
  const amendment =
    agreementType === "amendment"
      ? `\nThis Amendment modifies Contract ${parentContractNumber ?? "[PARENT CONTRACT]"}. Except for the terms expressly stated here, the original agreement remains unchanged. If there is a conflict, this Amendment controls.\n`
      : "";
  const additional = input.additionalTerms.trim()
    ? `\n15. ADDITIONAL TERMS\n${input.additionalTerms.trim()}\n`
    : "";
  return `${heading}\nContract ${contractNumber}\n${amendment}\nThis agreement is entered into as of ${effectiveDate} by and between ${input.providerLegalName || "[PROVIDER LEGAL NAME]"}, located at ${input.providerAddress || "[PROVIDER ADDRESS]"} (“Provider”), and ${input.clientLegalName || "[CLIENT LEGAL NAME]"}, located at ${input.clientAddress || "[CLIENT ADDRESS]"} (“Client”). Provider and Client are each a “Party” and together the “Parties.”\n\n1. SERVICES AND DELIVERABLES\nProvider will furnish the ${input.planName}. Included services and deliverables: ${input.includedServices}\n\n2. NFC CARDS\nProvider will supply ${input.nfcCardQuantity} programmed NFC card${input.nfcCardQuantity === 1 ? "" : "s"}. Client is responsible for physical custody and proper use. Replacement, additional, custom-printed, or reprogrammed cards are outside the included quantity unless stated in writing.\n\n3. TERM\nThe initial term is ${input.termMonths} month${input.termMonths === 1 ? "" : "s"}, beginning on the Effective Date. ${renewal}\n\n4. FEES AND PAYMENT\nThe service fee is ${money(input.billingAmountCents)} per ${cadence}, payable in ${installments} installment${installments === 1 ? "" : "s"}. The exact initial-term commitment is ${money(cents)}, excluding applicable taxes and separately accepted upgrades. ${input.paymentTerms}\n\nThe amount, billing cadence, installment count, and initial-term commitment generated in this Section control over conflicting payment-procedure text.\n\n5. UPGRADES AND CHANGES\n${input.upgradeTerms}\nNo requested upgrade changes this agreement unless both Parties accept a written amendment identifying the changed services, fees, and effective date.\n\n6. CLIENT RESPONSIBILITIES\nClient will provide accurate business, branding, content, authorized-user, and payment information; obtain rights and consents for material it supplies; protect account credentials and NFC cards; and use the services lawfully. Client is responsible for reviewing rewards, offers, and customer-facing content before publication.\n\n7. SERVICE AND MAINTENANCE\nProvider will use commercially reasonable efforts to maintain the service and address support requests. Scheduled maintenance, third-party platform outages, internet failures, force majeure events, and work outside the included services are not service breaches. Provider may make reasonable technical or security changes that do not materially reduce the purchased service.\n\n8. INTELLECTUAL PROPERTY AND DATA\nEach Party retains ownership of its pre-existing materials. Client grants Provider a limited license to host, display, process, and back up Client-supplied material solely to provide the services. Provider retains its platform, software, workflows, templates, and general know-how. Client retains its business content and customer data, subject to applicable law and the service’s documented privacy and security practices.\n\n9. CONFIDENTIALITY\nEach Party will use reasonable care to protect nonpublic business, technical, customer, and financial information received from the other Party and will use it only to perform or receive services, except where disclosure is required by law or the information is independently developed or lawfully public.\n\n10. WARRANTIES AND DISCLAIMERS\nEach Party represents that it has authority to enter this agreement. Provider warrants that services will be performed in a professional and workmanlike manner. EXCEPT FOR EXPRESS WARRANTIES IN THIS AGREEMENT, THE SERVICES ARE PROVIDED “AS IS” AND PROVIDER DISCLAIMS IMPLIED WARRANTIES TO THE MAXIMUM EXTENT PERMITTED BY LAW. PROVIDER DOES NOT GUARANTEE ANY PARTICULAR REVENUE, CUSTOMER PARTICIPATION, UPTIME, OR BUSINESS RESULT.\n\n11. LIMITATION OF LIABILITY\nTO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES OR LOST PROFITS ARISING FROM THIS AGREEMENT. EXCEPT FOR PAYMENT OBLIGATIONS, FRAUD, WILLFUL MISCONDUCT, OR CONFIDENTIALITY BREACHES, EACH PARTY’S AGGREGATE LIABILITY WILL NOT EXCEED THE INITIAL-TERM COMMITMENT STATED IN SECTION 4.\n\n12. TERMINATION\n${input.terminationTerms}\nThe fixed initial term and automatic-renewal selection generated in Section 3 control over conflicting termination or renewal text.\n\n13. GOVERNING LAW; VENUE\nThis agreement is governed by the laws of ${input.governingLaw || "[GOVERNING LAW]"}, without regard to conflict-of-law rules. The Parties consent to exclusive venue in ${input.venue || "[VENUE]"}, unless applicable law requires otherwise. Before filing a claim, the Parties will first attempt in good faith for 30 days to resolve the dispute through written notice and direct discussion.\n\n14. GENERAL TERMS\nNeither Party may assign this agreement without the other Party’s written consent, except to a successor in a merger, reorganization, or sale of substantially all relevant assets. Notices must be sent to the email or physical address stated here. If one provision is unenforceable, the remainder stays effective and the provision will be enforced to the maximum lawful extent. A waiver must be written. This agreement, accepted amendments, and referenced order details are the entire agreement and supersede prior discussions about its subject. Counterparts and electronic signatures are permitted. Structured quantities, term, billing cadence, fees, commitment, and renewal settings generated from the contract fields control over conflicting custom prose unless a signed amendment expressly identifies and replaces the specific structured term.\n${additional}\nELECTRONIC SIGNATURE AND RECORD CONSENT\nEach signer agrees to conduct this transaction electronically, confirms the ability to access and retain this agreement, intends the typed signature and acceptance action to serve as the signer’s electronic signature, and agrees that the electronically stored record may be used as the authoritative copy. Each signer may print or save the record before acceptance and may request a paper copy from ${input.providerEmail || "[PROVIDER EMAIL]"}.\n\nCLIENT\n${input.clientLegalName || "[CLIENT LEGAL NAME]"}\nAuthorized signer: ${input.clientSignerName || "[SIGNER NAME]"}\nTitle: ${input.clientSignerTitle || "[SIGNER TITLE]"}\nEmail: ${input.clientEmail || "[SIGNER EMAIL]"}\n\nPROVIDER\n${input.providerLegalName || "[PROVIDER LEGAL NAME]"}\nAuthorized signer: ${input.providerSignerName || "[PROVIDER SIGNER]"}\nTitle: ${input.providerSignerTitle || "[PROVIDER SIGNER TITLE]"}\nEmail: ${input.providerEmail || "[PROVIDER EMAIL]"}\nProvider electronic signature is recorded when the authenticated platform administrator issues this exact document.`;
}

function validateIssuable(input: ContractInput): void {
  const required: Array<[string, string]> = [
    [input.providerLegalName, "Provider legal name"],
    [input.providerAddress, "Provider address"],
    [input.providerEmail, "Provider email"],
    [input.providerSignerName, "Provider signer name"],
    [input.providerSignerTitle, "Provider signer title"],
    [input.clientLegalName, "Client legal name"],
    [input.clientAddress, "Client address"],
    [input.clientSignerName, "Client signer name"],
    [input.clientSignerTitle, "Client signer title"],
    [input.clientEmail, "Client email"],
    [input.governingLaw, "Governing law"],
    [input.venue, "Venue"],
  ];
  const missing = required.find(([value]) => !value.trim());
  if (missing)
    throw Object.assign(new Error(`${missing[1]} is required before issuing`), { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(input.providerEmail) || !/^\S+@\S+\.\S+$/.test(input.clientEmail))
    throw Object.assign(new Error("Valid provider and client emails are required before issuing"), {
      status: 400,
    });
  contractCommitment(input);
}

async function addEvent(
  query: { query: (text: string, values?: unknown[]) => Promise<unknown> },
  contractId: string,
  eventType: string,
  actorUserId: string | null,
  agreementSha256: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await query.query(
    `INSERT INTO service_contract_events(id,contract_id,event_type,actor_user_id,agreement_sha256,metadata)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [id("cev"), contractId, eventType, actorUserId, agreementSha256, JSON.stringify(metadata)],
  );
}

export async function listPlanTemplates(user: SessionUser): Promise<ServicePlanTemplate[]> {
  requirePlatformAdmin(user);
  const result = await getPool().query<PlanRow>(
    "SELECT * FROM service_plan_templates WHERE active=true ORDER BY name, version DESC",
  );
  return result.rows.map(rowToPlan);
}
export async function createPlanTemplate(
  user: SessionUser,
  input: ContractInput,
): Promise<ServicePlanTemplate> {
  requirePlatformAdmin(user);
  contractCommitment(input);
  const templateId = id("plan");
  const versionResult = await getPool().query<{ version: number }>(
    "SELECT COALESCE(MAX(version),0)+1 AS version FROM service_plan_templates WHERE lower(name)=lower($1)",
    [input.planName],
  );
  const version = Number(versionResult.rows[0]?.version ?? 1);
  const result = await getPool().query<PlanRow>(
    `INSERT INTO service_plan_templates(id,name,version,billing_interval,billing_amount_cents,
      term_months,nfc_card_quantity,included_services,payment_terms,upgrade_terms,
      termination_terms,auto_renews,created_by_user_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      templateId,
      input.planName,
      version,
      input.billingInterval,
      input.billingAmountCents,
      input.termMonths,
      input.nfcCardQuantity,
      input.includedServices,
      input.paymentTerms,
      input.upgradeTerms,
      input.terminationTerms,
      input.autoRenews,
      user.id,
    ],
  );
  return rowToPlan(result.rows[0]!);
}
export async function listContracts(user: SessionUser): Promise<ServiceContract[]> {
  requirePlatformAdmin(user);
  const result = await getPool().query<ContractRow>(
    "SELECT * FROM service_contracts ORDER BY created_at DESC, id DESC",
  );
  return result.rows.map((row) => rowToContract(row));
}

export async function previewContract(
  user: SessionUser,
  contractId: string,
): Promise<ContractPreview> {
  requirePlatformAdmin(user);
  const result = await getPool().query<ContractRow>(
    "SELECT * FROM service_contracts WHERE id=$1 AND status='draft'",
    [contractId],
  );
  const row = result.rows[0];
  if (!row)
    throw Object.assign(new Error("Only a saved draft contract can be previewed"), { status: 409 });
  const input = rowToContract(row);
  validateIssuable(input);
  let parentNumber: string | undefined;
  if (row.parent_contract_id) {
    const parent = await getPool().query<{ contract_number: string }>(
      "SELECT contract_number FROM service_contracts WHERE id=$1",
      [row.parent_contract_id],
    );
    parentNumber = parent.rows[0]?.contract_number;
  }
  const agreementText = renderAgreement(
    input,
    row.contract_number,
    row.agreement_type,
    parentNumber,
  );
  return {
    contractNumber: row.contract_number,
    providerLegalName: row.provider_legal_name,
    clientLegalName: row.client_legal_name,
    agreementText,
    agreementSha256: hash(agreementText),
  };
}

async function insertContract(
  user: SessionUser,
  input: ContractInput,
  agreementType: AgreementType,
  parentContractId: string | null,
): Promise<ServiceContract> {
  const contractId = id("ctr");
  const number = nextContractNumber();
  let planVersion: number | null = null;
  if (input.planTemplateId) {
    const plan = await getPool().query<{ version: number }>(
      "SELECT version FROM service_plan_templates WHERE id=$1 AND active=true",
      [input.planTemplateId],
    );
    if (!plan.rows[0])
      throw Object.assign(new Error("Selected plan template is unavailable"), { status: 400 });
    planVersion = Number(plan.rows[0].version);
  }
  const result = await getPool().query<ContractRow>(
    `INSERT INTO service_contracts(
      id,contract_number,agreement_type,parent_contract_id,linked_business_id,
      plan_template_id,plan_template_version,provider_legal_name,provider_address,
      provider_email,provider_signer_name,provider_signer_title,client_legal_name,
      client_address,client_signer_name,client_signer_title,client_email,plan_name,
      billing_interval,billing_amount_cents,term_months,nfc_card_quantity,included_services,
      payment_terms,upgrade_terms,termination_terms,additional_terms,auto_renews,
      governing_law,venue,effective_date,created_by_user_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32) RETURNING *`,
    [
      contractId,
      number,
      agreementType,
      parentContractId,
      input.linkedBusinessId,
      input.planTemplateId,
      planVersion,
      input.providerLegalName,
      input.providerAddress,
      input.providerEmail,
      input.providerSignerName,
      input.providerSignerTitle,
      input.clientLegalName,
      input.clientAddress,
      input.clientSignerName,
      input.clientSignerTitle,
      input.clientEmail,
      input.planName,
      input.billingInterval,
      input.billingAmountCents,
      input.termMonths,
      input.nfcCardQuantity,
      input.includedServices,
      input.paymentTerms,
      input.upgradeTerms,
      input.terminationTerms,
      input.additionalTerms,
      input.autoRenews,
      input.governingLaw,
      input.venue,
      input.effectiveDate,
      user.id,
    ],
  );
  await addEvent(
    getPool(),
    contractId,
    agreementType === "amendment" ? "amendment_created" : "created",
    user.id,
    null,
    { planTemplateId: input.planTemplateId, planVersion },
  );
  return rowToContract(result.rows[0]!);
}
export async function createContract(
  user: SessionUser,
  input = defaultContractInput(),
): Promise<ServiceContract> {
  requirePlatformAdmin(user);
  return insertContract(user, input, "initial", null);
}
export async function createAmendment(
  user: SessionUser,
  parentId: string,
): Promise<ServiceContract> {
  requirePlatformAdmin(user);
  const parent = await getPool().query<ContractRow>(
    "SELECT * FROM service_contracts WHERE id=$1 AND status='accepted'",
    [parentId],
  );
  if (!parent.rows[0])
    throw Object.assign(new Error("Only an accepted contract can be amended"), { status: 409 });
  const input = rowToContract(parent.rows[0]);
  return insertContract(
    user,
    {
      ...input,
      planTemplateId: null,
      effectiveDate: null,
      additionalTerms: "Describe the accepted upgrade and every changed term here.",
    },
    "amendment",
    parentId,
  );
}
export async function updateContract(
  user: SessionUser,
  contractId: string,
  input: ContractInput,
): Promise<ServiceContract> {
  requirePlatformAdmin(user);
  const result = await getPool().query<ContractRow>(
    `UPDATE service_contracts SET linked_business_id=$2,plan_template_id=$3,
      provider_legal_name=$4,provider_address=$5,provider_email=$6,provider_signer_name=$7,
      provider_signer_title=$8,client_legal_name=$9,client_address=$10,client_signer_name=$11,
      client_signer_title=$12,client_email=$13,plan_name=$14,billing_interval=$15,
      billing_amount_cents=$16,term_months=$17,nfc_card_quantity=$18,included_services=$19,
      payment_terms=$20,upgrade_terms=$21,termination_terms=$22,additional_terms=$23,
      auto_renews=$24,governing_law=$25,venue=$26,effective_date=$27,updated_at=now()
     WHERE id=$1 AND status='draft' RETURNING *`,
    [
      contractId,
      input.linkedBusinessId,
      input.planTemplateId,
      input.providerLegalName,
      input.providerAddress,
      input.providerEmail,
      input.providerSignerName,
      input.providerSignerTitle,
      input.clientLegalName,
      input.clientAddress,
      input.clientSignerName,
      input.clientSignerTitle,
      input.clientEmail,
      input.planName,
      input.billingInterval,
      input.billingAmountCents,
      input.termMonths,
      input.nfcCardQuantity,
      input.includedServices,
      input.paymentTerms,
      input.upgradeTerms,
      input.terminationTerms,
      input.additionalTerms,
      input.autoRenews,
      input.governingLaw,
      input.venue,
      input.effectiveDate,
    ],
  );
  if (!result.rows[0])
    throw Object.assign(new Error("Only a draft contract can be edited"), { status: 409 });
  await addEvent(getPool(), contractId, "updated", user.id, null);
  return rowToContract(result.rows[0]);
}
export async function issueContract(
  user: SessionUser,
  contractId: string,
  providerConsent: boolean,
): Promise<ServiceContract> {
  requirePlatformAdmin(user);
  if (!providerConsent)
    throw Object.assign(new Error("Provider electronic signature consent is required"), {
      status: 400,
    });
  const client = await getPool().connect();
  const token = randomBytes(32).toString("base64url");
  const accessCode = randomBytes(4).toString("hex").toUpperCase();
  try {
    await client.query("BEGIN");
    const current = await client.query<ContractRow>(
      "SELECT * FROM service_contracts WHERE id=$1 FOR UPDATE",
      [contractId],
    );
    const row = current.rows[0];
    if (!row) throw Object.assign(new Error("Contract not found"), { status: 404 });
    if (row.status !== "draft")
      throw Object.assign(new Error("Only a draft contract can be issued"), { status: 409 });
    const input = rowToContract(row);
    validateIssuable(input);
    let parentNumber: string | undefined;
    if (row.parent_contract_id) {
      const parent = await client.query<{ contract_number: string }>(
        "SELECT contract_number FROM service_contracts WHERE id=$1",
        [row.parent_contract_id],
      );
      parentNumber = parent.rows[0]?.contract_number;
    }
    const agreementText = renderAgreement(
      input,
      row.contract_number,
      row.agreement_type,
      parentNumber,
    );
    const agreementSha256 = hash(agreementText);
    const result = await client.query<ContractRow>(
      `UPDATE service_contracts SET status='sent',agreement_text=$2,agreement_sha256=$3,
       provider_signed_at=now(),provider_signer_user_id=$4,sent_at=now(),updated_at=now()
       WHERE id=$1 RETURNING *`,
      [contractId, agreementText, agreementSha256, user.id],
    );
    await client.query(
      `INSERT INTO service_contract_tokens(id,contract_id,token_hash,access_code_hash,expires_at)
       VALUES($1,$2,$3,$4,now()+interval '30 days')`,
      [id("ctk"), contractId, hash(token), hash(accessCode)],
    );
    await addEvent(client, contractId, "issued", user.id, agreementSha256, {
      contractNumber: row.contract_number,
      providerSignerName: input.providerSignerName,
      providerElectronicConsent: true,
    });
    await client.query("COMMIT");
    const issued = rowToContract(
      { ...result.rows[0]!, acceptance_expires_at: new Date(Date.now() + 30 * 86400000) },
      { token, accessCode },
    );
    return issued;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function verifiedPublicRow(
  token: string,
  accessCode: string,
  markViewed: boolean,
): Promise<ContractRow> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<
      ContractRow & { token_id: string; access_code_hash: string; expires_at: string | Date }
    >(
      `SELECT c.*,t.id AS token_id,t.access_code_hash,t.expires_at
       FROM service_contracts c JOIN service_contract_tokens t ON t.contract_id=c.id
       WHERE t.token_hash=$1 AND t.consumed_at IS NULL AND t.revoked_at IS NULL
         AND t.expires_at>now() AND c.status='sent' FOR UPDATE`,
      [hash(token)],
    );
    const row = result.rows[0];
    if (!row)
      throw Object.assign(new Error("This contract link is invalid, expired, or already used"), {
        status: 404,
      });
    if (row.access_code_hash !== hash(accessCode.toUpperCase())) {
      await client.query(
        "UPDATE service_contract_tokens SET failed_attempts=failed_attempts+1,revoked_at=CASE WHEN failed_attempts>=7 THEN now() ELSE revoked_at END WHERE id=$1",
        [row.token_id],
      );
      await client.query("COMMIT");
      throw Object.assign(new Error("The contract access code is incorrect"), { status: 403 });
    }
    if (markViewed) {
      await client.query(
        "UPDATE service_contract_tokens SET viewed_at=COALESCE(viewed_at,now()) WHERE id=$1",
        [row.token_id],
      );
      await addEvent(client, row.id, "viewed", null, row.agreement_sha256);
    }
    await client.query("COMMIT");
    return { ...row, acceptance_expires_at: row.expires_at };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* transaction already completed */
    }
    throw error;
  } finally {
    client.release();
  }
}
function publicContract(row: ContractRow): PublicContract {
  if (
    !row.agreement_text ||
    !row.agreement_sha256 ||
    !row.acceptance_expires_at ||
    !row.provider_signed_at
  )
    throw Object.assign(new Error("Contract record is incomplete"), { status: 500 });
  return {
    contractNumber: row.contract_number,
    providerLegalName: row.provider_legal_name,
    providerSignerName: row.provider_signer_name,
    providerSignerTitle: row.provider_signer_title,
    providerSignedAt: iso(row.provider_signed_at)!,
    clientLegalName: row.client_legal_name,
    agreementText: row.agreement_text,
    agreementSha256: row.agreement_sha256,
    acceptanceExpiresAt: iso(row.acceptance_expires_at)!,
    status: row.status === "accepted" ? "accepted" : "sent",
    acceptedSignatureName: row.accepted_signature_name,
    acceptedSignatureTitle: row.accepted_signature_title,
    acceptedAt: iso(row.accepted_at),
  };
}
export async function getPublicContract(
  token: string,
  accessCode: string,
): Promise<PublicContract> {
  return publicContract(await verifiedPublicRow(token, accessCode, true));
}
export async function acceptContract(
  token: string,
  accessCode: string,
  input: { signatureName: string; signatureTitle: string; electronicConsent: boolean },
  evidence: { ip: string; userAgent: string },
): Promise<PublicContract> {
  if (!input.electronicConsent)
    throw Object.assign(new Error("Electronic signature consent is required"), { status: 400 });
  await verifiedPublicRow(token, accessCode, false);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<
      ContractRow & { token_id: string; access_code_hash: string; expires_at: string | Date }
    >(
      `SELECT c.*,t.id AS token_id,t.access_code_hash,t.expires_at
       FROM service_contracts c JOIN service_contract_tokens t ON t.contract_id=c.id
       WHERE t.token_hash=$1 AND t.consumed_at IS NULL AND t.revoked_at IS NULL
         AND t.expires_at>now() AND c.status='sent' FOR UPDATE`,
      [hash(token)],
    );
    const row = current.rows[0];
    if (!row || row.access_code_hash !== hash(accessCode.toUpperCase()))
      throw Object.assign(new Error("This contract session is no longer valid"), { status: 409 });
    let parentNumber: string | undefined;
    if (row.parent_contract_id) {
      const parent = await client.query<{ contract_number: string }>(
        "SELECT contract_number FROM service_contracts WHERE id=$1",
        [row.parent_contract_id],
      );
      parentNumber = parent.rows[0]?.contract_number;
    }
    const expectedText = renderAgreement(
      rowToContract(row),
      row.contract_number,
      row.agreement_type,
      parentNumber,
    );
    const expectedHash = hash(expectedText);
    if (row.agreement_text !== expectedText || row.agreement_sha256 !== expectedHash)
      throw Object.assign(new Error("Contract integrity verification failed"), { status: 409 });
    const result = await client.query<ContractRow>(
      `UPDATE service_contracts SET status='accepted',accepted_at=now(),accepted_signature_name=$2,
       accepted_signature_title=$3,accepted_email=client_email,accepted_ip=$4,
       accepted_user_agent=$5,electronic_consent=true,updated_at=now()
       WHERE id=$1 RETURNING *`,
      [row.id, input.signatureName, input.signatureTitle, evidence.ip, evidence.userAgent],
    );
    await client.query("UPDATE service_contract_tokens SET consumed_at=now() WHERE id=$1", [
      row.token_id,
    ]);
    await addEvent(client, row.id, "accepted", null, expectedHash, {
      signerName: input.signatureName,
      signerTitle: input.signatureTitle,
      ip: evidence.ip,
      userAgent: evidence.userAgent,
    });
    await client.query("COMMIT");
    return publicContract({ ...result.rows[0]!, acceptance_expires_at: row.expires_at });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function voidContract(
  user: SessionUser,
  contractId: string,
): Promise<ServiceContract> {
  requirePlatformAdmin(user);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<ContractRow>(
      `UPDATE service_contracts SET status='void',voided_at=now(),updated_at=now()
       WHERE id=$1 AND status IN ('draft','sent') RETURNING *`,
      [contractId],
    );
    if (!result.rows[0])
      throw Object.assign(new Error("Accepted or missing contracts cannot be voided"), {
        status: 409,
      });
    await client.query(
      "UPDATE service_contract_tokens SET revoked_at=now() WHERE contract_id=$1 AND consumed_at IS NULL",
      [contractId],
    );
    await addEvent(client, contractId, "voided", user.id, result.rows[0].agreement_sha256);
    await client.query("COMMIT");
    return rowToContract(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
