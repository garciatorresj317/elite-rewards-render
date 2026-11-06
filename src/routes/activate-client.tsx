import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ExperienceBackdrop } from "@/components/ExperienceTheme";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api-client";
export const Route = createFileRoute("/activate-client")({
  head: () => ({ meta: [{ title: "Activate client account | Elite Rewards" }] }),
  component: ActivateClient,
});
function ActivateClient() {
  const navigate = useNavigate();
  const { t, errorMessage } = useI18n();
  const [invitation, setInvitation] = useState<Awaited<
      ReturnType<typeof api.clientInvitation>
    > | null>(null),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const token =
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("token") ?? "");
  useEffect(() => {
    if (!token) {
      setError(t("This client invitation is missing its secure token."));
      return;
    }
    void api
      .clientInvitation(token)
      .then(setInvitation)
      .catch((cause) => setError(errorMessage(cause, "Activation failed")));
  }, [token, t, errorMessage]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(t("Passwords do not match"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.activateClient(token, password);
      await navigate({ to: "/admin" });
    } catch (cause) {
      setError(errorMessage(cause, "Activation failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`auth-page theme-${invitation?.visualSettings.themeKey ?? "elite-signature"}`}>
      <ExperienceBackdrop settings={invitation?.visualSettings ?? null} audience="member" />
      <header className="auth-header themed-surface-content">
        <BrandMark />
        <Link to="/" className="back-link">
          {t("Back to site")}
        </Link>
      </header>
      <main className="auth-main themed-surface-content">
        <section className="auth-card">
          <span className="auth-icon">
            <LockKeyhole />
          </span>
          <span className="section-kicker">{t("Client activation")}</span>
          <h1>{t("Activate your rewards program")}</h1>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {invitation && (
            <form onSubmit={submit}>
              <div className="activation-summary">
                <strong>{invitation.businessName}</strong>
                <span>{invitation.locationName}</span>
                <small>
                  {invitation.ownerName} · {invitation.ownerEmail}
                </small>
              </div>
              <label>
                {t("Create owner password")}
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={200}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                {t("Confirm password")}
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={200}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <button className="admin-primary full" disabled={busy}>
                {busy ? t("Activating…") : t("Activate owner account")}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
