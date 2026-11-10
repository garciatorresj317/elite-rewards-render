import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { PasswordField } from "@/components/PasswordField";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password | Elite Rewards" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const { t, errorMessage } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [memberAccess, setMemberAccess] = useState(false);
  const [token] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("token") ?? ""),
  );

  useEffect(() => {
    const access = new URLSearchParams(window.location.search).get("access");
    setMemberAccess(access === "member");
    if (token) {
      const cleanUrl = access === "member" ? "/reset-password?access=member" : "/reset-password";
      window.history.replaceState(window.history.state, "", cleanUrl);
    }
    if (!token) {
      setError(t("This password reset link is incomplete."));
      setChecking(false);
      return;
    }
    void api
      .passwordResetStatus(token)
      .then(() => setValid(true))
      .catch((cause) => setError(errorMessage(cause, "Password reset unavailable")))
      .finally(() => setChecking(false));
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
      const result = await api.resetPassword(token, password);
      setMemberAccess(result.role === "member");
      setValid(false);
      setComplete(true);
    } catch (cause) {
      setError(errorMessage(cause, "Password reset failed"));
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
          <Sparkles size={14} /> {t("Secure password reset")}
        </span>
        <h1>{t("Create a new password")}</h1>
        <p>{t("Use a new password with at least 8 characters.")}</p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {checking && <p className="auth-note">{t("Checking your secure reset link…")}</p>}
        {complete && (
          <div className="form-success" role="status">
            <strong>{t("Password reset complete")}</strong>
            <p>{t("Sign in with your new password on the next screen.")}</p>
            <Link
              to="/login"
              search={memberAccess ? { access: "member" as const } : {}}
              className="button button-light full"
            >
              {t("Continue to sign in")}
            </Link>
          </div>
        )}
        {valid && (
          <form onSubmit={submit}>
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              showRequirement
            />
            <PasswordField
              label="Confirm password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
            <button className="admin-primary full" disabled={busy}>
              {busy ? t("Resetting…") : t("Reset password")}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
