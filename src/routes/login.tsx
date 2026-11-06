import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in | Elite Rewards" }] }),
  component: Login,
});
function Login() {
  const navigate = useNavigate();
  const { t, errorMessage } = useI18n();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [setupRequired, setSetupRequired] = useState(false);
  useEffect(() => {
    void Promise.all([api.session(), api.setupStatus()])
      .then(([session, setup]) => {
        setSetupRequired(setup.setupRequired);
        if (session.user)
          void navigate({ to: session.user.role === "member" ? "/wallet" : "/admin" });
      })
      .catch((cause) => setError(errorMessage(cause, "Sign in failed")));
  }, [navigate, errorMessage]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.login(email, password);
      await navigate({ to: result.user.role === "member" ? "/wallet" : "/admin" });
    } catch (cause) {
      setError(errorMessage(cause, "Sign in failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <header className="wallet-header container-mid">
        <BrandMark />
        <Link to="/" className="back-link">
          <ArrowLeft size={17} /> {t("Back to site")}
        </Link>
      </header>
      <main className="auth-card">
        <span className="modal-icon">
          <LockKeyhole />
        </span>
        <span className="section-kicker">
          <Sparkles size={14} /> {t("Secure access")}
        </span>
        <h1>{t("Sign in to Elite Rewards")}</h1>
        <p>
          {t(
            "Use your business or member account. Rewards balances are stored in the production ledger.",
          )}
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            {t("Email")}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            {t("Password")}
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="admin-primary full" disabled={busy}>
            {busy ? t("Signing in…") : t("Sign in")}
          </button>
        </form>
        {setupRequired && (
          <p className="auth-note">
            {t(
              "Initial setup is required. Open the private setup page and use the deployment setup token.",
            )}
          </p>
        )}
      </main>
    </div>
  );
}
