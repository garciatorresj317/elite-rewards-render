import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Sparkles, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/join")({
  head: () => ({ meta: [{ title: "Join rewards | Elite Rewards" }] }),
  component: JoinReferral,
});

function JoinReferral() {
  const navigate = useNavigate();
  const [context, setContext] = useState<{ businessName: string; locationName: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const referralCode =
    typeof window === "undefined" ? "" : (new URLSearchParams(location.search).get("ref") ?? "");

  useEffect(() => {
    if (!referralCode) {
      setError("This referral link is incomplete.");
      setBusy(false);
      return;
    }
    api
      .referralEnrollment(referralCode)
      .then(setContext)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Referral unavailable"))
      .finally(() => setBusy(false));
  }, [referralCode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (form.password !== form.confirmPassword) throw new Error("Passwords do not match");
      await api.joinReferral({
        name: form.name,
        email: form.email,
        password: form.password,
        referralCode,
      });
      await navigate({ to: "/wallet" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enrollment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <header className="wallet-header container-mid">
        <BrandMark />
        <a className="back-link" href="/login">
          Already a member?
        </a>
      </header>
      <main className="auth-card referral-join-card">
        <span className="modal-icon">
          <Users />
        </span>
        <span className="section-kicker">
          <Sparkles size={15} /> Member referral
        </span>
        <h1>Join {context?.businessName ?? "Elite Rewards"}</h1>
        {busy && <p>Validating your secure referral link…</p>}
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
                <Check size={14} /> Referred member enrollment
              </small>
            </div>
            <p>
              Create your private rewards wallet. Your account starts at zero points; referral
              bonuses are not enabled unless the business publishes a policy.
            </p>
            <form onSubmit={submit}>
              <label>
                Full name
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
                Email
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
                Password
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
                Confirm password
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
                <input required type="checkbox" />I agree to the business rewards program terms and
                electronic account access.
              </label>
              <button className="admin-primary full" disabled={submitting}>
                {submitting ? "Creating wallet…" : "Join rewards"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
