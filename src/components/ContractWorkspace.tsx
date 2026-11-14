import { CheckCircle2, Copy, FileSignature, Plus, Send, ShieldCheck, XCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type ClientSummary,
  type ContractDraft,
  type ContractPreview,
  type ServiceContract,
  type ServicePlanTemplate,
} from "@/lib/api-client";

type Translate = (english: string, spanish: string) => string;

const customPlan: ContractDraft = {
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

const toDraft = (contract: ServiceContract): ContractDraft => ({
  linkedBusinessId: contract.linkedBusinessId,
  planTemplateId: contract.planTemplateId,
  providerLegalName: contract.providerLegalName,
  providerAddress: contract.providerAddress,
  providerEmail: contract.providerEmail,
  providerSignerName: contract.providerSignerName,
  providerSignerTitle: contract.providerSignerTitle,
  clientLegalName: contract.clientLegalName,
  clientAddress: contract.clientAddress,
  clientSignerName: contract.clientSignerName,
  clientSignerTitle: contract.clientSignerTitle,
  clientEmail: contract.clientEmail,
  planName: contract.planName,
  billingInterval: contract.billingInterval,
  billingAmountCents: contract.billingAmountCents,
  termMonths: contract.termMonths,
  nfcCardQuantity: contract.nfcCardQuantity,
  includedServices: contract.includedServices,
  paymentTerms: contract.paymentTerms,
  upgradeTerms: contract.upgradeTerms,
  terminationTerms: contract.terminationTerms,
  additionalTerms: contract.additionalTerms,
  autoRenews: contract.autoRenews,
  governingLaw: contract.governingLaw,
  venue: contract.venue,
  effectiveDate: contract.effectiveDate,
});

export function ContractWorkspace({ clients, tr }: { clients: ClientSummary[]; tr: Translate }) {
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [plans, setPlans] = useState<ServicePlanTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContractDraft>(customPlan);
  const [acceptanceLink, setAcceptanceLink] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [preview, setPreview] = useState<ContractPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () => contracts.find((contract) => contract.id === selectedId) ?? null,
    [contracts, selectedId],
  );
  const load = useCallback(async () => {
    try {
      const [contractResult, planResult] = await Promise.all([
        api.contracts(),
        api.contractPlans(),
      ]);
      setContracts(contractResult.contracts);
      setPlans(planResult.plans);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Contracts failed to load", "No se pudieron cargar los contratos"),
      );
    }
  }, [tr]);
  useEffect(() => void load(), [load]);

  const choose = (contract: ServiceContract) => {
    setSelectedId(contract.id);
    setDraft(toDraft(contract));
    setAcceptanceLink("");
    setAccessCode("");
    setPreview(null);
    setError("");
    setNotice("");
  };
  const newContract = () => {
    setSelectedId(null);
    setDraft({ ...customPlan });
    setAcceptanceLink("");
    setAccessCode("");
    setPreview(null);
    setError("");
    setNotice(tr("Custom Plan template ready.", "Plantilla del Plan Personalizado lista."));
  };
  const set = <K extends keyof ContractDraft>(key: K, value: ContractDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const linkClient = (businessId: string | null) => {
    const client = clients.find((item) => item.id === businessId);
    setDraft((current) => ({
      ...current,
      linkedBusinessId: businessId,
      ...(client
        ? {
            clientLegalName: client.name,
            clientSignerName: client.ownerName,
            clientEmail: client.ownerEmail,
          }
        : {}),
    }));
  };
  const applyPlan = (planId: string) => {
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;
    setDraft((current) => ({
      ...current,
      planTemplateId: plan.id,
      planName: plan.planName,
      billingInterval: plan.billingInterval,
      billingAmountCents: plan.billingAmountCents,
      termMonths: plan.termMonths,
      nfcCardQuantity: plan.nfcCardQuantity,
      includedServices: plan.includedServices,
      paymentTerms: plan.paymentTerms,
      upgradeTerms: plan.upgradeTerms,
      terminationTerms: plan.terminationTerms,
      autoRenews: plan.autoRenews,
    }));
  };
  const savePlanTemplate = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api.createContractPlan(draft);
      setPlans((current) => [result.plan, ...current.filter((plan) => plan.id !== result.plan.id)]);
      set("planTemplateId", result.plan.id);
      setNotice(
        tr(
          `${result.plan.planName} v${result.plan.version} saved as a reusable template.`,
          `${result.plan.planName} v${result.plan.version} se guardó como plantilla reutilizable.`,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Plan template could not be saved", "No se pudo guardar la plantilla"),
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = selected
        ? await api.updateContract(selected.id, draft)
        : await api.createContract(draft);
      const saved = result.contract;
      setContracts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedId(saved.id);
      setDraft(toDraft(saved));
      setPreview(null);
      setNotice(tr("Contract draft saved.", "Borrador del contrato guardado."));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Contract could not be saved", "No se pudo guardar el contrato"),
      );
    } finally {
      setBusy(false);
    }
  };
  const issue = async () => {
    if (!selected) return;
    if (
      !window.confirm(
        tr(
          "Lock these terms and create a 30-day signature link?",
          "¿Bloquear estos términos y crear un enlace de firma de 30 días?",
        ),
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await api.issueContract(selected.id, true);
      setContracts((current) =>
        current.map((item) => (item.id === result.contract.id ? result.contract : item)),
      );
      const absolute = `${window.location.origin}${result.contract.acceptancePath}`;
      setAcceptanceLink(absolute);
      setAccessCode(result.contract.accessCode ?? "");
      setPreview(null);
      setNotice(
        tr(
          "Terms locked. Secure acceptance link created.",
          "Términos bloqueados. Enlace seguro creado.",
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Contract could not be sent", "No se pudo enviar el contrato"),
      );
    } finally {
      setBusy(false);
    }
  };
  const previewSelected = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      setPreview(await api.previewContract(selected.id));
      setNotice(
        tr(
          "Review this exact generated document before issuing it.",
          "Revisa este documento exacto antes de emitirlo.",
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Contract preview failed", "No se pudo previsualizar el contrato"),
      );
    } finally {
      setBusy(false);
    }
  };
  const voidSelected = async () => {
    if (
      !selected ||
      !window.confirm(
        tr(
          "Void this contract and disable its signature link?",
          "¿Anular este contrato y desactivar su enlace de firma?",
        ),
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await api.voidContract(selected.id);
      setContracts((current) =>
        current.map((item) => (item.id === result.contract.id ? result.contract : item)),
      );
      setAcceptanceLink("");
      setAccessCode("");
      setNotice(tr("Contract voided.", "Contrato anulado."));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Contract could not be voided", "No se pudo anular el contrato"),
      );
    } finally {
      setBusy(false);
    }
  };
  const current = contracts.find((item) => item.id === selectedId) ?? selected;
  const editable = !current || current.status === "draft";
  const installments =
    draft.billingInterval === "monthly" ? draft.termMonths : draft.termMonths / 12;
  const total = (draft.billingAmountCents * installments) / 100;

  return (
    <section className="contracts-workspace" aria-labelledby="contracts-title">
      <div className="dashboard-appearance-intro panel">
        <div>
          <span className="modal-icon">
            <FileSignature />
          </span>
          <div>
            <span className="section-kicker">
              {tr("Client agreements", "Acuerdos de clientes")}
            </span>
            <h2 id="contracts-title">{tr("Service contracts", "Contratos de servicio")}</h2>
            <p>
              {tr(
                "Create adjustable monthly or yearly agreements, lock the issued terms, and keep signature evidence.",
                "Crea acuerdos mensuales o anuales ajustables, bloquea los términos emitidos y conserva evidencia de firma.",
              )}
            </p>
          </div>
        </div>
        <button type="button" className="admin-primary" onClick={newContract}>
          <Plus /> {tr("New contract", "Nuevo contrato")}
        </button>
      </div>
      <div className="contract-legal-note">
        <ShieldCheck />
        <span>
          {tr(
            "Electronic acceptance records intent, identity details, timestamp, document hash, IP, and device information. Enforceability still depends on complete party details, applicable law, and attorney review.",
            "La aceptación electrónica registra intención, identidad, fecha, hash del documento, IP y dispositivo. La exigibilidad aún depende de datos completos, ley aplicable y revisión legal.",
          )}
        </span>
      </div>
      {(error || notice) && (
        <div className={error ? "form-error" : "notice"} role={error ? "alert" : "status"}>
          {error || notice}
        </div>
      )}
      <div className="contracts-layout">
        <aside className="contract-list panel">
          <h3>{tr("Agreement records", "Registros de acuerdos")}</h3>
          {!contracts.length && (
            <p>{tr("No saved contracts yet.", "Aún no hay contratos guardados.")}</p>
          )}
          {contracts.map((contract) => (
            <button
              type="button"
              key={contract.id}
              className={contract.id === selectedId ? "active" : ""}
              onClick={() => choose(contract)}
            >
              <span>
                <strong>{contract.contractNumber}</strong>
                <small>
                  {contract.clientLegalName || tr("Client not entered", "Cliente no indicado")}
                </small>
              </span>
              <span className={`contract-status ${contract.status}`}>{contract.status}</span>
            </button>
          ))}
        </aside>
        <form className="contract-editor panel" onSubmit={save}>
          <div className="contract-editor-heading">
            <div>
              <span className="section-kicker">
                {current?.contractNumber ?? tr("New agreement", "Nuevo acuerdo")}
              </span>
              <h3>{tr("Adjust contract terms", "Ajustar términos")}</h3>
            </div>
            <strong>
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
              {tr("initial commitment", "compromiso inicial")}
            </strong>
          </div>
          {!editable && (
            <div className="contract-locked">
              <ShieldCheck />{" "}
              {tr(
                "Issued terms are locked. Create a new agreement or amendment to change them.",
                "Los términos emitidos están bloqueados. Crea un acuerdo nuevo o enmienda para cambiarlos.",
              )}
            </div>
          )}
          <fieldset disabled={!editable || busy}>
            <legend>{tr("Parties", "Partes")}</legend>
            <div className="form-grid two">
              <label>
                {tr("Link existing client (optional)", "Vincular cliente existente (opcional)")}
                <select
                  value={draft.linkedBusinessId ?? ""}
                  onChange={(event) => linkClient(event.target.value || null)}
                >
                  <option value="">{tr("Prospective client", "Cliente prospectivo")}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Provider legal name", "Nombre legal del proveedor")}
                <input
                  value={draft.providerLegalName}
                  onChange={(event) => set("providerLegalName", event.target.value)}
                  placeholder="Elite Rewards legal entity"
                />
              </label>
              <label>
                {tr("Provider email", "Correo del proveedor")}
                <input
                  type="email"
                  value={draft.providerEmail}
                  onChange={(event) => set("providerEmail", event.target.value)}
                />
              </label>
              <label>
                {tr("Provider authorized signer", "Firmante autorizado del proveedor")}
                <input
                  value={draft.providerSignerName}
                  onChange={(event) => set("providerSignerName", event.target.value)}
                />
              </label>
              <label>
                {tr("Provider signer title", "Cargo del firmante del proveedor")}
                <input
                  value={draft.providerSignerTitle}
                  onChange={(event) => set("providerSignerTitle", event.target.value)}
                />
              </label>
              <label className="full-span">
                {tr("Provider address", "Dirección del proveedor")}
                <textarea
                  value={draft.providerAddress}
                  onChange={(event) => set("providerAddress", event.target.value)}
                />
              </label>
              <label>
                {tr("Client legal name", "Nombre legal del cliente")}
                <input
                  value={draft.clientLegalName}
                  onChange={(event) => set("clientLegalName", event.target.value)}
                />
              </label>
              <label>
                {tr("Authorized signer", "Firmante autorizado")}
                <input
                  value={draft.clientSignerName}
                  onChange={(event) => set("clientSignerName", event.target.value)}
                />
              </label>
              <label>
                {tr("Signer title", "Cargo del firmante")}
                <input
                  value={draft.clientSignerTitle}
                  onChange={(event) => set("clientSignerTitle", event.target.value)}
                  placeholder="Owner, President, Manager"
                />
              </label>
              <label>
                {tr("Signer email", "Correo del firmante")}
                <input
                  type="email"
                  value={draft.clientEmail}
                  onChange={(event) => set("clientEmail", event.target.value)}
                />
              </label>
              <label className="full-span">
                {tr("Client address", "Dirección del cliente")}
                <textarea
                  value={draft.clientAddress}
                  onChange={(event) => set("clientAddress", event.target.value)}
                />
              </label>
            </div>
          </fieldset>
          <fieldset disabled={!editable || busy}>
            <legend>{tr("Plan and price", "Plan y precio")}</legend>
            <div className="form-grid four">
              <label>
                {tr("Saved plan template", "Plantilla de plan guardada")}
                <select
                  value={draft.planTemplateId ?? ""}
                  onChange={(event) => applyPlan(event.target.value)}
                >
                  <option value="">{tr("One-time custom terms", "Términos personalizados")}</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.planName} v{plan.version}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Plan", "Plan")}
                <input
                  value={draft.planName}
                  onChange={(event) => set("planName", event.target.value)}
                />
              </label>
              <label>
                {tr("Billing", "Facturación")}
                <select
                  value={draft.billingInterval}
                  onChange={(event) =>
                    set("billingInterval", event.target.value as "monthly" | "yearly")
                  }
                >
                  <option value="monthly">{tr("Monthly", "Mensual")}</option>
                  <option value="yearly">{tr("Yearly", "Anual")}</option>
                </select>
              </label>
              <label>
                {tr("Amount per billing period", "Monto por período")}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={(draft.billingAmountCents / 100).toFixed(2)}
                  onChange={(event) =>
                    set("billingAmountCents", Math.round(Number(event.target.value) * 100))
                  }
                />
              </label>
              <label>
                {tr("Term (months)", "Plazo (meses)")}
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={draft.termMonths}
                  onChange={(event) => set("termMonths", Number(event.target.value))}
                />
              </label>
              <label>
                {tr("Included NFC cards", "Tarjetas NFC incluidas")}
                <input
                  type="number"
                  min="0"
                  value={draft.nfcCardQuantity}
                  onChange={(event) => set("nfcCardQuantity", Number(event.target.value))}
                />
              </label>
              <label>
                {tr("Effective date (optional)", "Fecha efectiva (opcional)")}
                <input
                  type="date"
                  value={draft.effectiveDate ?? ""}
                  onChange={(event) => set("effectiveDate", event.target.value || null)}
                />
              </label>
              <label>
                {tr("Governing law", "Ley aplicable")}
                <input
                  value={draft.governingLaw}
                  onChange={(event) => set("governingLaw", event.target.value)}
                />
              </label>
              <label>
                {tr("Court venue", "Jurisdicción judicial")}
                <input
                  value={draft.venue}
                  onChange={(event) => set("venue", event.target.value)}
                  placeholder="Orange County, Florida"
                />
              </label>
            </div>
            <label className="contract-renewal">
              <input
                type="checkbox"
                checked={draft.autoRenews}
                onChange={(event) => set("autoRenews", event.target.checked)}
              />{" "}
              {tr(
                "Automatically renew after the initial term",
                "Renovar automáticamente después del plazo inicial",
              )}
            </label>
          </fieldset>
          <fieldset disabled={!editable || busy}>
            <legend>{tr("Services and legal terms", "Servicios y términos legales")}</legend>
            <label>
              {tr("Included services", "Servicios incluidos")}
              <textarea
                rows={4}
                value={draft.includedServices}
                onChange={(event) => set("includedServices", event.target.value)}
              />
            </label>
            <label>
              {tr("Payment terms", "Términos de pago")}
              <textarea
                rows={5}
                value={draft.paymentTerms}
                onChange={(event) => set("paymentTerms", event.target.value)}
              />
            </label>
            <label>
              {tr("Upgrade terms", "Términos de actualización")}
              <textarea
                rows={4}
                value={draft.upgradeTerms}
                onChange={(event) => set("upgradeTerms", event.target.value)}
              />
            </label>
            <label>
              {tr("Termination terms", "Términos de terminación")}
              <textarea
                rows={5}
                value={draft.terminationTerms}
                onChange={(event) => set("terminationTerms", event.target.value)}
              />
            </label>
            <label>
              {tr("Additional terms (optional)", "Términos adicionales (opcional)")}
              <textarea
                rows={4}
                value={draft.additionalTerms}
                onChange={(event) => set("additionalTerms", event.target.value)}
              />
            </label>
          </fieldset>
          <div className="contract-actions">
            {editable && (
              <button className="admin-primary" disabled={busy}>
                {busy ? tr("Saving…", "Guardando…") : tr("Save draft", "Guardar borrador")}
              </button>
            )}
            {editable && (
              <button
                type="button"
                className="client-customize"
                disabled={busy}
                onClick={() => void savePlanTemplate()}
              >
                <Plus /> {tr("Save as reusable plan", "Guardar como plan reutilizable")}
              </button>
            )}
            {current?.status === "draft" && (
              <button
                type="button"
                className="client-customize"
                disabled={busy}
                onClick={() => void previewSelected()}
              >
                <FileSignature /> {tr("Preview exact agreement", "Ver acuerdo exacto")}
              </button>
            )}
            {current?.status === "draft" && (
              <button
                type="button"
                className="client-customize"
                disabled={busy}
                onClick={() => void issue()}
              >
                <Send />{" "}
                {tr(
                  "Provider sign, lock terms, and issue",
                  "Firmar como proveedor, bloquear y emitir",
                )}
              </button>
            )}
            {(current?.status === "draft" || current?.status === "sent") && (
              <button
                type="button"
                className="danger-button"
                disabled={busy}
                onClick={() => void voidSelected()}
              >
                <XCircle /> {tr("Void", "Anular")}
              </button>
            )}
          </div>
          {preview && (
            <section className="contract-admin-preview" aria-label="Contract preview">
              <div>
                <strong>{preview.contractNumber}</strong>
                <code>{preview.agreementSha256}</code>
              </div>
              <pre>{preview.agreementText}</pre>
            </section>
          )}
          {acceptanceLink && (
            <div className="contract-link">
              <label>
                {tr("Private acceptance link", "Enlace privado de aceptación")}
                <input readOnly value={acceptanceLink} />
              </label>
              <label>
                {tr("Separate access code", "Código de acceso separado")}
                <input readOnly value={accessCode} />
              </label>
              <div className="contract-credential-actions">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(acceptanceLink);
                    setNotice(tr("Private link copied.", "Enlace privado copiado."));
                  }}
                >
                  <Copy /> {tr("Copy link", "Copiar enlace")}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(accessCode);
                    setNotice(tr("Access code copied.", "Código de acceso copiado."));
                  }}
                >
                  <Copy /> {tr("Copy code separately", "Copiar código por separado")}
                </button>
              </div>
            </div>
          )}
          {current?.status === "accepted" && (
            <div className="contract-accepted-summary">
              <CheckCircle2 />
              <div>
                <strong>{tr("Electronically accepted", "Aceptado electrónicamente")}</strong>
                <span>
                  {current.acceptedSignatureName} · {current.acceptedSignatureTitle}
                </span>
                <small>
                  {current.acceptedAt ? new Date(current.acceptedAt).toLocaleString() : ""} ·{" "}
                  {current.agreementSha256}
                </small>
              </div>
            </div>
          )}
          {current?.status === "accepted" && (
            <button
              type="button"
              className="client-customize"
              disabled={busy}
              onClick={async () => {
                const result = await api.createContractAmendment(current.id);
                setContracts((items) => [result.contract, ...items]);
                choose(result.contract);
              }}
            >
              <Plus /> {tr("Create upgrade amendment", "Crear enmienda de actualización")}
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
