import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { PasswordField } from "@/components/PasswordField";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api-client";
export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Initial setup | Elite Rewards" }] }),
  component: Setup,
});
const initial = {
  setupToken: "",
  businessName: "Elite Rewards Business",
  locationName: "Primary location",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
};
function Setup() {
  const navigate = useNavigate();
  const { t, errorMessage } = useI18n();
  const [form, setForm] = useState(initial),
    [allowed, setAllowed] = useState<boolean | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api
      .setupStatus()
      .then((x) => setAllowed(x.setupRequired))
      .catch((e) => setError(errorMessage(e, "Setup failed")));
  }, [errorMessage]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.setup(form);
      await navigate({ to: "/admin" });
    } catch (cause) {
      setError(errorMessage(cause, "Setup failed"));
    } finally {
      setBusy(false);
    }
  };
  const field = (key: keyof typeof form, label: string, type = "text") =>
    type === "password" ? (
      <PasswordField
        label={label}
        autoComplete="new-password"
        minLength={key === "setupToken" ? 24 : 8}
        value={form[key]}
        onChange={(value) => setForm({ ...form, [key]: value })}
        showRequirement={key === "ownerPassword"}
      />
    ) : (
      <label>
        {t(label)}
        <input
          type={type}
          required
          minLength={2}
          autoComplete={type === "email" ? "email" : undefined}
          value={form[key]}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        />
      </label>
    );
  return (
    <div className="auth-page">
      <header className="wallet-header container-mid">
        <BrandMark />
      </header>
      <main className="auth-card setup-card">
        <span className="modal-icon">
          <ShieldCheck />
        </span>
        <span className="section-kicker">{t("One-time production setup")}</span>
        <h1>{allowed === false ? t("Setup is complete") : t("Create the first live program")}</h1>
        {allowed === false ? (
          <p>{t("The one-time setup route is closed. Sign in with an existing account.")}</p>
        ) : (
          <>
            <p>
              {t(
                "This creates one business, one location, and the owner account. Members are added after setup. This cannot be run twice.",
              )}
            </p>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <form onSubmit={submit} className="setup-grid">
              {field("setupToken", "Deployment setup token", "password")}
              {field("businessName", "Business name")}
              {field("locationName", "Location name")}
              {field("ownerName", "Owner name")}
              {field("ownerEmail", "Owner email", "email")}
              {field("ownerPassword", "Owner password", "password")}
              <button className="admin-primary full" disabled={busy}>
                {busy ? t("Creating…") : t("Create production program")}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
