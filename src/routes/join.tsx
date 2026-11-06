import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Sparkles, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api-client";
export const Route = createFileRoute("/join")({
  head: () => ({ meta: [{ title: "Join rewards | Elite Rewards" }] }),
  component: JoinReferral,
});
function JoinReferral() {
  const navigate = useNavigate();
  const { t, errorMessage } = useI18n();
  const [context, setContext] = useState<{ businessName: string; locationName: string } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [submitting, setSubmitting] = useState(false),
    [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const referralCode =
    typeof window === "undefined" ? "" : (new URLSearchParams(location.search).get("ref") ?? "");
  useEffect(() => {
    if (!referralCode) {
      setError(t("This referral link is incomplete."));
      setBusy(false);
      return;
    }
    api
      .referralEnrollment(referralCode)
      .then(setContext)
      .catch((cause) => setError(errorMessage(cause, "Referral unavailable")))
      .finally(() => setBusy(false));
  }, [referralCode, t, errorMessage]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (form.password !== form.confirmPassword) {
        setError(t("Passwords do not match"));
        return;
      }
      await api.joinReferral({
        name: form.name,
        email: form.email,
        password: form.password,
        referralCode,
      });
      await navigate({ to: "/wallet" });
    } catch (cause) {
      setError(errorMessage(cause, "Enrollment failed"));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="auth-page">
      <header className="wallet-header container-mid">
        <BrandMark />
        <a className="back-link" href="/login">
          {t("Already a member?")}
        </a>
      </header>
      <main className="auth-card referral-join-card">
        <span className="modal-icon">
          <Users />
        </span>
        <span className="section-kicker">
          <Sparkles size={15} /> {t("Member referral")}
        </span>
        <h1>
          {t("Join {businessName}", { businessName: context?.businessName ?? "Elite Rewards" })}
        </h1>
        {busy && <p>{t("Validating your secure referral link…")}</p>}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {context && (
          <>
            <div className="activation-summary">
              <strong>{context.businessName}</strong>
              <span>{context.locationName}</span>
              <small>
                <Check size={14} /> {t("Referred member enrollment")}
              </small>
            </div>
            <p>
              {t(
                "Create your private rewards wallet. Your account starts at zero points; referral bonuses are not enabled unless the business publishes a policy.",
              )}
            </p>
            <form onSubmit={submit}>
              <label>
                {t("Full name")}
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label>
                {t("Email")}
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>
              <label>
                {t("Password")}
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={200}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
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
                  value={form.confirmPassword}
                  onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                />
              </label>
              <label className="consent-check">
                <input required type="checkbox" />
                <span>
                  {t(
                    "I agree to the business rewards program terms and electronic account access.",
                  )}
                </span>
              </label>
              <button className="admin-primary full" disabled={submitting}>
                {submitting ? t("Creating wallet…") : t("Join rewards")}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
