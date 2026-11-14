import type { PoolClient } from "pg";
import { getPool, id } from "./database.ts";
import type { SessionUser } from "./auth.ts";

export const paymentStatuses = ["scheduled", "due", "paid", "void"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export type DocumentAuditEvent = {
  id: string;
  businessId: string;
  businessName: string;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ContractPayment = {
  id: string;
  serviceContractId: string | null;
  contractNumber: string | null;
  linkedBusinessId: string | null;
  clientName: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: PaymentStatus;
  paidAt: string | null;
  paymentMethod: string;
  reference: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ContractPaymentInput = {
  serviceContractId: string | null;
  linkedBusinessId: string | null;
  clientName: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: PaymentStatus;
  paymentMethod: string;
  reference: string;
  notes: string;
};

type AuditRow = {
  id: string;
  business_id: string;
  business_name: string;
  actor_name: string | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown> | string;
  created_at: string | Date;
};

type PaymentRow = {
  id: string;
  service_contract_id: string | null;
  contract_number: string | null;
  linked_business_id: string | null;
  client_name: string;
  description: string;
  amount_cents: number;
  due_date: string | Date;
  status: PaymentStatus;
  paid_at: string | Date | null;
  payment_method: string;
  reference: string;
  notes: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function requirePlatformAdmin(user: SessionUser): void {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function paymentRow(row: PaymentRow): ContractPayment {
  return {
    id: row.id,
    serviceContractId: row.service_contract_id,
    contractNumber: row.contract_number,
    linkedBusinessId: row.linked_business_id,
    clientName: row.client_name,
    description: row.description,
    amountCents: Number(row.amount_cents),
    dueDate: dateOnly(row.due_date),
    status: row.status,
    paidAt: row.paid_at ? iso(row.paid_at) : null,
    paymentMethod: row.payment_method,
    reference: row.reference,
    notes: row.notes,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const paymentSelect = `SELECT p.*, c.contract_number
  FROM contract_payments p
  LEFT JOIN service_contracts c ON c.id = p.service_contract_id`;

export async function listDocumentAudits(
  user: SessionUser,
  limit = 250,
): Promise<DocumentAuditEvent[]> {
  requirePlatformAdmin(user);
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const result = await getPool().query<AuditRow>(
    `SELECT a.id,a.business_id,b.name AS business_name,u.name AS actor_name,a.action,
            a.target_type,a.target_id,a.metadata,a.created_at
       FROM audit_events a
       JOIN businesses b ON b.id = a.business_id
       LEFT JOIN users u ON u.id = a.actor_user_id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $1`,
    [safeLimit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata:
      typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : row.metadata,
    createdAt: iso(row.created_at),
  }));
}

export async function listContractPayments(user: SessionUser): Promise<ContractPayment[]> {
  requirePlatformAdmin(user);
  const result = await getPool().query<PaymentRow>(
    `${paymentSelect} ORDER BY p.due_date DESC, p.created_at DESC, p.id DESC`,
  );
  return result.rows.map(paymentRow);
}

async function validatePaymentLinks(
  query: Pick<PoolClient, "query">,
  input: ContractPaymentInput,
): Promise<string | null> {
  let linkedBusinessId = input.linkedBusinessId;
  if (input.serviceContractId) {
    const contract = await query.query<{ linked_business_id: string | null }>(
      "SELECT linked_business_id FROM service_contracts WHERE id=$1 AND status <> 'void'",
      [input.serviceContractId],
    );
    if (!contract.rows[0])
      throw Object.assign(new Error("Selected contract is unavailable"), { status: 400 });
    if (
      input.linkedBusinessId &&
      contract.rows[0].linked_business_id &&
      input.linkedBusinessId !== contract.rows[0].linked_business_id
    )
      throw Object.assign(new Error("Payment client does not match the selected contract"), {
        status: 400,
      });
    linkedBusinessId ??= contract.rows[0].linked_business_id;
  }
  if (linkedBusinessId) {
    const business = await query.query("SELECT id FROM businesses WHERE id=$1", [linkedBusinessId]);
    if (!business.rows[0])
      throw Object.assign(new Error("Selected client is unavailable"), { status: 400 });
  }
  return linkedBusinessId;
}

export async function createContractPayment(
  user: SessionUser,
  input: ContractPaymentInput,
): Promise<ContractPayment> {
  requirePlatformAdmin(user);
  const connection = await getPool().connect();
  try {
    await connection.query("BEGIN");
    const linkedBusinessId = await validatePaymentLinks(connection, input);
    const paymentId = id("pay");
    const paidAt = input.status === "paid" ? new Date() : null;
    const result = await connection.query<PaymentRow>(
      `WITH inserted AS (
         INSERT INTO contract_payments(
           id,service_contract_id,linked_business_id,client_name,description,amount_cents,
           due_date,status,paid_at,payment_method,reference,notes,created_by_user_id
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
       ) SELECT inserted.*, c.contract_number FROM inserted
         LEFT JOIN service_contracts c ON c.id = inserted.service_contract_id`,
      [
        paymentId,
        input.serviceContractId,
        linkedBusinessId,
        input.clientName,
        input.description,
        input.amountCents,
        input.dueDate,
        input.status,
        paidAt,
        input.paymentMethod,
        input.reference,
        input.notes,
        user.id,
      ],
    );
    await connection.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES($1,$2,$3,'platform.payment.created','contract_payment',$4,$5)`,
      [
        id("aud"),
        linkedBusinessId ?? user.businessId,
        user.id,
        paymentId,
        JSON.stringify({
          amountCents: input.amountCents,
          dueDate: input.dueDate,
          status: input.status,
          serviceContractId: input.serviceContractId,
        }),
      ],
    );
    await connection.query("COMMIT");
    return paymentRow(result.rows[0]!);
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateContractPaymentStatus(
  user: SessionUser,
  paymentId: string,
  status: PaymentStatus,
): Promise<ContractPayment> {
  requirePlatformAdmin(user);
  const connection = await getPool().connect();
  try {
    await connection.query("BEGIN");
    const paidAt = status === "paid" ? new Date() : null;
    const result = await connection.query<PaymentRow>(
      `WITH updated AS (
         UPDATE contract_payments
            SET status=$2,paid_at=$3,updated_at=now()
          WHERE id=$1 RETURNING *
       ) SELECT updated.*, c.contract_number FROM updated
         LEFT JOIN service_contracts c ON c.id = updated.service_contract_id`,
      [paymentId, status, paidAt],
    );
    const payment = result.rows[0];
    if (!payment) throw Object.assign(new Error("Payment record not found"), { status: 404 });
    await connection.query(
      `INSERT INTO audit_events(id,business_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES($1,$2,$3,'platform.payment.status.updated','contract_payment',$4,$5)`,
      [
        id("aud"),
        payment.linked_business_id ?? user.businessId,
        user.id,
        paymentId,
        JSON.stringify({ status }),
      ],
    );
    await connection.query("COMMIT");
    return paymentRow(payment);
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}
