import {
  CheckCircle2,
  ClipboardList,
  FileClock,
  FileSignature,
  FolderArchive,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ContractWorkspace } from "@/components/ContractWorkspace";
import {
  api,
  type ClientSummary,
  type ContractPayment,
  type ContractPaymentDraft,
  type ContractPaymentStatus,
  type DocumentAuditEvent,
  type ServiceContract,
} from "@/lib/api-client";

type Translate = (english: string, spanish: string) => string;
type DocumentSection = "contracts" | "audits" | "payments" | "files";

const sections: {
  id: DocumentSection;
  en: string;
  es: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: typeof FileSignature;
}[] = [
  {
    id: "contracts",
    en: "Contracts",
    es: "Contratos",
    descriptionEn: "Create, issue, and track signed agreements.",
    descriptionEs: "Crea, emite y registra acuerdos firmados.",
    icon: FileSignature,
  },
  {
    id: "audits",
    en: "Audits",
    es: "Auditorías",
    descriptionEn: "Review the platform's recorded business activity.",
    descriptionEs: "Revisa la actividad comercial registrada por la plataforma.",
    icon: ClipboardList,
  },
  {
    id: "payments",
    en: "Payments",
    es: "Pagos",
    descriptionEn: "Track contract billing, due dates, and paid records.",
    descriptionEs: "Registra cobros, vencimientos y pagos de contratos.",
    icon: ReceiptText,
  },
  {
    id: "files",
    en: "Other files",
    es: "Otros archivos",
    descriptionEn: "A reserved home for invoices, receipts, and client records.",
    descriptionEs: "Un espacio reservado para facturas, recibos y registros de clientes.",
    icon: FolderArchive,
  },
];

function formatAction(action: string): string {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
}

function AuditsWorkspace({ tr }: { tr: Translate }) {
  const [events, setEvents] = useState<DocumentAuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setEvents((await api.documentAudits()).events);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Audits failed to load", "No se cargaron las auditorías"),
      );
    } finally {
      setBusy(false);
    }
  }, [tr]);
  useEffect(() => void load(), [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) =>
      [event.businessName, event.actorName, event.action, event.targetType, event.targetId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [events, query]);

  return (
    <section className="document-section-workspace" aria-labelledby="audit-records-title">
      <div className="document-section-heading panel">
        <div>
          <span className="modal-icon">
            <ClipboardList />
          </span>
          <div>
            <span className="section-kicker">
              {tr("Recorded activity", "Actividad registrada")}
            </span>
            <h3 id="audit-records-title">{tr("Audit records", "Registros de auditoría")}</h3>
            <p>
              {tr(
                "Search recent client, member, reward, product, security, and payment activity.",
                "Busca actividad reciente de clientes, miembros, recompensas, productos, seguridad y pagos.",
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="admin-secondary"
          onClick={() => void load()}
          disabled={busy}
        >
          <FileClock /> {busy ? tr("Loading…", "Cargando…") : tr("Refresh", "Actualizar")}
        </button>
      </div>
      <label className="document-search panel">
        <Search />
        <span className="sr-only">{tr("Search audits", "Buscar auditorías")}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tr(
            "Search business, action, actor, or record…",
            "Buscar negocio, acción, actor o registro…",
          )}
        />
      </label>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="document-table-wrap panel">
        <table className="document-table">
          <thead>
            <tr>
              <th>{tr("Time", "Fecha")}</th>
              <th>{tr("Business", "Negocio")}</th>
              <th>{tr("Activity", "Actividad")}</th>
              <th>{tr("Actor", "Actor")}</th>
              <th>{tr("Record", "Registro")}</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && !busy && (
              <tr>
                <td colSpan={5}>
                  {tr("No matching audit records.", "No hay registros coincidentes.")}
                </td>
              </tr>
            )}
            {filtered.map((event) => (
              <tr key={event.id}>
                <td>
                  <time dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </td>
                <td>
                  <strong>{event.businessName}</strong>
                </td>
                <td>{formatAction(event.action)}</td>
                <td>{event.actorName ?? tr("System", "Sistema")}</td>
                <td>
                  <span>{event.targetType}</span>
                  <small>{event.targetId}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const blankPayment = (): ContractPaymentDraft => ({
  serviceContractId: null,
  linkedBusinessId: null,
  clientName: "",
  description: "Monthly Elite Rewards service",
  amountCents: 6000,
  dueDate: new Date().toISOString().slice(0, 10),
  status: "scheduled",
  paymentMethod: "",
  reference: "",
  notes: "",
});

function PaymentsWorkspace({ clients, tr }: { clients: ClientSummary[]; tr: Translate }) {
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [draft, setDraft] = useState<ContractPaymentDraft>(blankPayment);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [paymentResult, contractResult] = await Promise.all([
        api.contractPayments(),
        api.contracts(),
      ]);
      setPayments(paymentResult.payments);
      setContracts(contractResult.contracts);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Payments failed to load", "No se cargaron los pagos"),
      );
    }
  }, [tr]);
  useEffect(() => void load(), [load]);

  const totals = useMemo(
    () => ({
      outstanding: payments
        .filter((item) => item.status === "scheduled" || item.status === "due")
        .reduce((sum, item) => sum + item.amountCents, 0),
      paid: payments
        .filter((item) => item.status === "paid")
        .reduce((sum, item) => sum + item.amountCents, 0),
    }),
    [payments],
  );

  const set = <K extends keyof ContractPaymentDraft>(key: K, value: ContractPaymentDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const linkContract = (contractId: string | null) => {
    const contract = contracts.find((item) => item.id === contractId);
    setDraft((current) => ({
      ...current,
      serviceContractId: contractId,
      ...(contract
        ? {
            linkedBusinessId: contract.linkedBusinessId,
            clientName: contract.clientLegalName,
            description: `${contract.planName} service payment`,
            amountCents: contract.billingAmountCents,
          }
        : {}),
    }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = (await api.createContractPayment(draft)).payment;
      setPayments((current) => [saved, ...current]);
      setDraft(blankPayment());
      setShowForm(false);
      setNotice(tr("Payment record saved.", "Registro de pago guardado."));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Payment was not saved", "El pago no se guardó"),
      );
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (payment: ContractPayment, status: ContractPaymentStatus) => {
    setBusy(true);
    setError("");
    try {
      const saved = (await api.updateContractPaymentStatus(payment.id, status)).payment;
      setPayments((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Payment status was not updated", "El estado no se actualizó"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="document-section-workspace" aria-labelledby="payments-title">
      <div className="document-section-heading panel">
        <div>
          <span className="modal-icon">
            <ReceiptText />
          </span>
          <div>
            <span className="section-kicker">
              {tr("Contract billing", "Facturación de contratos")}
            </span>
            <h3 id="payments-title">{tr("Payment records", "Registros de pago")}</h3>
            <p>
              {tr(
                "Track what is scheduled, due, paid, or void without processing card payments inside Elite Rewards.",
                "Registra lo programado, vencido, pagado o anulado sin procesar tarjetas dentro de Elite Rewards.",
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="admin-primary"
          onClick={() => setShowForm((current) => !current)}
        >
          <Plus /> {tr("Add payment", "Agregar pago")}
        </button>
      </div>
      <div className="document-summary-grid">
        <article className="panel">
          <small>{tr("Outstanding", "Pendiente")}</small>
          <strong>
            ${(totals.outstanding / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </strong>
        </article>
        <article className="panel">
          <small>{tr("Recorded paid", "Pagado registrado")}</small>
          <strong>
            ${(totals.paid / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </strong>
        </article>
        <article className="panel">
          <small>{tr("Records", "Registros")}</small>
          <strong>{payments.length}</strong>
        </article>
      </div>
      {(error || notice) && (
        <div className={error ? "form-error" : "notice"} role={error ? "alert" : "status"}>
          {error || notice}
        </div>
      )}
      {showForm && (
        <form className="payment-form panel" onSubmit={save}>
          <div className="document-form-heading">
            <div>
              <span className="section-kicker">{tr("New record", "Nuevo registro")}</span>
              <h4>{tr("Record a contract payment", "Registrar un pago de contrato")}</h4>
            </div>
          </div>
          <div className="form-grid two">
            <label>
              {tr("Contract (optional)", "Contrato (opcional)")}
              <select
                value={draft.serviceContractId ?? ""}
                onChange={(event) => linkContract(event.target.value || null)}
              >
                <option value="">{tr("No contract selected", "Sin contrato seleccionado")}</option>
                {contracts
                  .filter((item) => item.status !== "void")
                  .map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contractNumber} —{" "}
                      {contract.clientLegalName || tr("Unnamed client", "Cliente sin nombre")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {tr("Existing client (optional)", "Cliente existente (opcional)")}
              <select
                value={draft.linkedBusinessId ?? ""}
                onChange={(event) => {
                  const id = event.target.value || null;
                  const client = clients.find((item) => item.id === id);
                  setDraft((current) => ({
                    ...current,
                    linkedBusinessId: id,
                    ...(client ? { clientName: client.name } : {}),
                  }));
                }}
              >
                <option value="">
                  {tr("Prospective or external client", "Cliente prospectivo o externo")}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Client name", "Nombre del cliente")}
              <input
                required
                minLength={2}
                value={draft.clientName}
                onChange={(event) => set("clientName", event.target.value)}
              />
            </label>
            <label>
              {tr("Description", "Descripción")}
              <input
                required
                minLength={2}
                value={draft.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </label>
            <label>
              {tr("Amount", "Cantidad")}
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={(draft.amountCents / 100).toFixed(2)}
                onChange={(event) =>
                  set("amountCents", Math.round(Number(event.target.value || 0) * 100))
                }
              />
            </label>
            <label>
              {tr("Due date", "Fecha de vencimiento")}
              <input
                required
                type="date"
                value={draft.dueDate}
                onChange={(event) => set("dueDate", event.target.value)}
              />
            </label>
            <label>
              {tr("Status", "Estado")}
              <select
                value={draft.status}
                onChange={(event) => set("status", event.target.value as ContractPaymentStatus)}
              >
                <option value="scheduled">{tr("Scheduled", "Programado")}</option>
                <option value="due">{tr("Due", "Vencido")}</option>
                <option value="paid">{tr("Paid", "Pagado")}</option>
                <option value="void">{tr("Void", "Anulado")}</option>
              </select>
            </label>
            <label>
              {tr("Payment method (optional)", "Método de pago (opcional)")}
              <input
                value={draft.paymentMethod}
                onChange={(event) => set("paymentMethod", event.target.value)}
                placeholder={tr("ACH, cash, card, check…", "ACH, efectivo, tarjeta, cheque…")}
              />
            </label>
            <label>
              {tr("Reference (optional)", "Referencia (opcional)")}
              <input
                value={draft.reference}
                onChange={(event) => set("reference", event.target.value)}
              />
            </label>
            <label>
              {tr("Notes (optional)", "Notas (opcional)")}
              <textarea
                value={draft.notes}
                onChange={(event) => set("notes", event.target.value)}
              />
            </label>
          </div>
          <div className="contract-actions">
            <button className="admin-primary" disabled={busy} type="submit">
              <CheckCircle2 />{" "}
              {busy ? tr("Saving…", "Guardando…") : tr("Save payment record", "Guardar registro")}
            </button>
            <button type="button" className="admin-secondary" onClick={() => setShowForm(false)}>
              {tr("Cancel", "Cancelar")}
            </button>
          </div>
        </form>
      )}
      <div className="document-table-wrap panel">
        <table className="document-table payment-table">
          <thead>
            <tr>
              <th>{tr("Due", "Vence")}</th>
              <th>{tr("Client / contract", "Cliente / contrato")}</th>
              <th>{tr("Description", "Descripción")}</th>
              <th>{tr("Amount", "Cantidad")}</th>
              <th>{tr("Status", "Estado")}</th>
            </tr>
          </thead>
          <tbody>
            {!payments.length && (
              <tr>
                <td colSpan={5}>
                  {tr("No payment records yet.", "Aún no hay registros de pago.")}
                </td>
              </tr>
            )}
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{new Date(`${payment.dueDate}T12:00:00`).toLocaleDateString()}</td>
                <td>
                  <strong>{payment.clientName}</strong>
                  <small>{payment.contractNumber ?? tr("Manual record", "Registro manual")}</small>
                </td>
                <td>
                  {payment.description}
                  {payment.reference && <small>{payment.reference}</small>}
                </td>
                <td>
                  <strong>
                    $
                    {(payment.amountCents / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                </td>
                <td>
                  <select
                    aria-label={tr(
                      `Status for ${payment.clientName}`,
                      `Estado de ${payment.clientName}`,
                    )}
                    disabled={busy}
                    value={payment.status}
                    onChange={(event) =>
                      void updateStatus(payment, event.target.value as ContractPaymentStatus)
                    }
                  >
                    <option value="scheduled">{tr("Scheduled", "Programado")}</option>
                    <option value="due">{tr("Due", "Vencido")}</option>
                    <option value="paid">{tr("Paid", "Pagado")}</option>
                    <option value="void">{tr("Void", "Anulado")}</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OtherFilesWorkspace({ tr }: { tr: Translate }) {
  return (
    <section className="document-section-workspace">
      <div className="document-empty-state panel">
        <span className="modal-icon">
          <FolderArchive />
        </span>
        <span className="section-kicker">
          {tr("Expandable document center", "Centro de documentos ampliable")}
        </span>
        <h3>{tr("Other business files", "Otros archivos comerciales")}</h3>
        <p>
          {tr(
            "This area is reserved for future invoices, receipts, tax documents, service reports, and client uploads. Contracts, audits, and payment records are already active in their own sections.",
            "Esta área está reservada para futuras facturas, recibos, documentos fiscales, informes de servicio y archivos de clientes. Contratos, auditorías y pagos ya están activos en sus propias secciones.",
          )}
        </p>
        <div className="document-future-grid">
          <span>{tr("Invoices", "Facturas")}</span>
          <span>{tr("Receipts", "Recibos")}</span>
          <span>{tr("Service reports", "Informes de servicio")}</span>
          <span>{tr("Client files", "Archivos de clientes")}</span>
        </div>
      </div>
    </section>
  );
}

export function DocumentsWorkspace({ clients, tr }: { clients: ClientSummary[]; tr: Translate }) {
  const [active, setActive] = useState<DocumentSection>("contracts");
  return (
    <section className="documents-workspace" aria-labelledby="documents-title">
      <div className="dashboard-appearance-intro panel">
        <div>
          <span className="modal-icon">
            <FolderArchive />
          </span>
          <div>
            <span className="section-kicker">
              {tr("Business records", "Registros comerciales")}
            </span>
            <h2 id="documents-title">{tr("Documents", "Documentos")}</h2>
            <p>
              {tr(
                "Keep contracts, audit history, payment records, and future client files together in one secure admin area.",
                "Mantén contratos, historial de auditoría, pagos y futuros archivos de clientes en una sola área administrativa segura.",
              )}
            </p>
          </div>
        </div>
        <span className="dashboard-scope-badge">
          <ShieldCheck /> {tr("Platform admin only", "Solo administrador")}
        </span>
      </div>
      <nav
        className="document-tabs panel"
        aria-label={tr("Document categories", "Categorías de documentos")}
      >
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              type="button"
              key={section.id}
              className={active === section.id ? "active" : ""}
              aria-current={active === section.id ? "page" : undefined}
              onClick={() => setActive(section.id)}
            >
              <Icon />
              <span>
                <strong>{tr(section.en, section.es)}</strong>
                <small>{tr(section.descriptionEn, section.descriptionEs)}</small>
              </span>
            </button>
          );
        })}
      </nav>
      {active === "contracts" && <ContractWorkspace clients={clients} tr={tr} />}
      {active === "audits" && <AuditsWorkspace tr={tr} />}
      {active === "payments" && <PaymentsWorkspace clients={clients} tr={tr} />}
      {active === "files" && <OtherFilesWorkspace tr={tr} />}
    </section>
  );
}
