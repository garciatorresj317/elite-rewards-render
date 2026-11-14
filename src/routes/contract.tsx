import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, FileSignature, Printer, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api, type PublicContract } from "@/lib/api-client";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/contract")({
  head: () => ({ meta: [{ title: "Review service agreement | Elite Rewards" }] }),
  component: ContractAcceptancePage,
});

function ContractAcceptancePage() {
  const { locale } = useI18n();
  const tr = (english: string, spanish: string) => (locale === "es" ? spanish : english);
  const token =
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("token") ?? "");
  const [accessCode, setAccessCode] = useState("");
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [signatureTitle, setSignatureTitle] = useState("");
  const [electronicConsent, setElectronicConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setContract(await api.publicContract(token, accessCode));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Contract failed to load", "No se pudo cargar el contrato"),
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setContract(
        await api.acceptContract({
          token,
          accessCode,
          signatureName,
          signatureTitle,
          electronicConsent,
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr("Contract acceptance failed", "La aceptación falló"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="contract-page">
      <header className="contract-header">
        <BrandMark />
        {contract && (
          <button className="button button-dark" type="button" onClick={() => window.print()}>
            <Printer size={17} /> {tr("Print or save PDF", "Imprimir o guardar PDF")}
          </button>
        )}
      </header>
      <main className="contract-main">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {!token ? (
          <div className="form-error" role="alert">
            {tr(
              "This contract link is missing its secure token.",
              "Este enlace no tiene su token seguro.",
            )}
          </div>
        ) : !contract ? (
          <form className="contract-signature panel contract-unlock" onSubmit={unlock}>
            <ShieldCheck />
            <span className="section-kicker">{tr("Private agreement", "Acuerdo privado")}</span>
            <h1>{tr("Enter the separate access code", "Ingresa el código de acceso separado")}</h1>
            <p>
              {tr(
                "The sender must give you the eight-character code separately from this link.",
                "El remitente debe darte el código de ocho caracteres por separado del enlace.",
              )}
            </p>
            <label>
              {tr("Access code", "Código de acceso")}
              <input
                required
                minLength={8}
                maxLength={8}
                autoComplete="one-time-code"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
              />
            </label>
            <button className="admin-primary" disabled={busy || accessCode.length !== 8}>
              {busy ? tr("Verifying…", "Verificando…") : tr("Open agreement", "Abrir acuerdo")}
            </button>
          </form>
        ) : (
          <>
            <section className="contract-document" aria-labelledby="contract-title">
              <div className="contract-document-title">
                <FileSignature aria-hidden="true" />
                <div>
                  <span>{tr("Secure service agreement", "Acuerdo de servicio seguro")}</span>
                  <h1 id="contract-title">{contract.contractNumber}</h1>
                  <p>
                    {contract.providerLegalName} and {contract.clientLegalName}
                  </p>
                </div>
              </div>
              <pre>{contract.agreementText}</pre>
              <footer>
                <strong>{tr("Document integrity", "Integridad del documento")}</strong>
                <code>{contract.agreementSha256}</code>
              </footer>
            </section>
            {contract.status === "accepted" ? (
              <section className="contract-accepted panel" aria-live="polite">
                <CheckCircle2 />
                <div>
                  <span className="section-kicker">
                    {tr("Acceptance recorded", "Aceptación registrada")}
                  </span>
                  <h2>{tr("Agreement complete", "Acuerdo completado")}</h2>
                  <p>
                    {contract.acceptedSignatureName} · {contract.acceptedSignatureTitle}
                    {contract.acceptedAt
                      ? ` · ${new Date(contract.acceptedAt).toLocaleString()}`
                      : ""}
                  </p>
                  <p>
                    {tr("Provider signed by", "Proveedor firmado por")}{" "}
                    {contract.providerSignerName}
                    {` · ${contract.providerSignerTitle} · ${new Date(contract.providerSignedAt).toLocaleString()}`}
                  </p>
                </div>
              </section>
            ) : (
              <form className="contract-signature panel" onSubmit={submit}>
                <span className="section-kicker">
                  {tr("Electronic acceptance", "Aceptación electrónica")}
                </span>
                <h2>{tr("Sign this agreement", "Firma este acuerdo")}</h2>
                <p>
                  {tr(
                    "Review the complete English-language agreement above. Print or save it before signing. The English document is the operative version.",
                    "Revisa el acuerdo completo en inglés. Imprímelo o guárdalo antes de firmar. El documento en inglés es la versión vigente.",
                  )}
                </p>
                <div className="form-grid two">
                  <label>
                    {tr("Legal name", "Nombre legal")}
                    <input
                      required
                      autoComplete="name"
                      value={signatureName}
                      onChange={(event) => setSignatureName(event.target.value)}
                    />
                  </label>
                  <label>
                    {tr("Title and authority", "Cargo y autoridad")}
                    <input
                      required
                      value={signatureTitle}
                      onChange={(event) => setSignatureTitle(event.target.value)}
                    />
                  </label>
                </div>
                <label className="contract-consent">
                  <input
                    required
                    type="checkbox"
                    checked={electronicConsent}
                    onChange={(event) => setElectronicConsent(event.target.checked)}
                  />
                  <span>
                    {tr(
                      "I am authorized to bind the Client. I agree to use electronic records and signatures, can access and retain this agreement, intend my typed name and this acceptance action as my electronic signature, and agree to all terms.",
                      "Estoy autorizado para obligar al Cliente. Acepto usar registros y firmas electrónicas, puedo acceder y conservar este acuerdo, y pretendo que mi nombre escrito y esta acción sean mi firma electrónica.",
                    )}
                  </span>
                </label>
                <button className="admin-primary" disabled={busy || !electronicConsent}>
                  <FileSignature />{" "}
                  {busy
                    ? tr("Recording acceptance…", "Registrando…")
                    : tr("Accept and sign agreement", "Aceptar y firmar")}
                </button>
              </form>
            )}
          </>
        )}
        <Link to="/" className="back-link contract-home-link">
          {tr("Elite Rewards home", "Inicio de Elite Rewards")}
        </Link>
      </main>
    </div>
  );
}
