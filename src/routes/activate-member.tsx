import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserRoundCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ExperienceBackdrop } from "@/components/ExperienceTheme";
import { PasswordField } from "@/components/PasswordField";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api-client";
import { experienceStyle } from "@/lib/experience-style";
export const Route = createFileRoute("/activate-member")({
  head: () => ({ meta: [{ title: "Activate member account | Elite Rewards" }] }),
  component: ActivateMember,
});
function ActivateMember() {
  const navigate = useNavigate();
  const { t, errorMessage } = useI18n();
  const [invitation, setInvitation] = useState<Awaited<
      ReturnType<typeof api.memberInvitation>
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
      setError(t("This member invitation is missing its secure token."));
      return;
    }
    void api
      .memberInvitation(token)
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
      await api.activateMember(token, password);
      await navigate({ to: "/wallet" });
    } catch (cause) {
      setError(errorMessage(cause, "Activation failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={`auth-page theme-${invitation?.visualSettings.themeKey ?? "elite-signature"}`}
      style={experienceStyle(invitation?.visualSettings ?? null)}
    >
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
            <UserRoundCheck />
          </span>
          <span className="section-kicker">{t("Member activation")}</span>
          <h1>{t("Activate your Elite Rewards wallet")}</h1>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {invitation && (
            <form onSubmit={submit}>
              <div className="activation-summary">
                <strong>{invitation.memberName}</strong>
                <span>
                  {invitation.businessName} · {invitation.locationName}
                </span>
                <small>{invitation.memberEmail}</small>
              </div>
              <PasswordField
                label="Create member password"
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
                {busy ? t("Activating…") : t("Activate member wallet")}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
