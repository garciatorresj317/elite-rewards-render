import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api-client";

type ForgotPasswordSearch = { access?: "member" };

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (search: Record<string, unknown>): ForgotPasswordSearch =>
    search["access"] === "member" ? { access: "member" } : {},
  head: () => ({ meta: [{ title: "Forgot password | Elite Rewards" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const { access } = Route.useSearch();
  const memberAccess = access === "member";
  const { t, errorMessage } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (cause) {
      setError(errorMessage(cause, "Password reset request failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="wallet-header container-mid">
        <BrandMark />
        <Link
          to="/login"
          search={memberAccess ? { access: "member" as const } : {}}
          className="back-link"
        >
          <ArrowLeft size={17} /> {t("Back to sign in")}
        </Link>
      </header>
      <main className="auth-card">
        <span className="modal-icon">
          <KeyRound />
        </span>
        <span className="section-kicker">
          <Sparkles size={14} /> {t("Account recovery")}
        </span>
        <h1>{t("Forgot your password?")}</h1>
        <p>
          {t(
            "Enter the email on your Elite Rewards account. If it matches an active account, Elite Rewards will prepare a secure reset request.",
          )}
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {sent ? (
          <div className="form-success" role="status">
            <strong>{t("Request received")}</strong>
            <p>
              {t(
                "If that email belongs to an active account, the Elite Rewards administrator can now provide a private reset link.",
              )}
            </p>
            <Link
              to="/login"
              search={memberAccess ? { access: "member" as const } : {}}
              className="button button-light full"
            >
              {t("Return to sign in")}
            </Link>
          </div>
        ) : (
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
            <button className="admin-primary full" disabled={busy}>
              {busy ? t("Submitting…") : t("Request password reset")}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
