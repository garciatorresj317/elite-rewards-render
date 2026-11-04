import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserRoundCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/activate-member")({
  head: () => ({ meta: [{ title: "Activate member account | Elite Rewards" }] }),
  component: ActivateMember,
});

function ActivateMember() {
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Awaited<
    ReturnType<typeof api.memberInvitation>
  > | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const token =
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("token") ?? "");

  useEffect(() => {
    if (!token) {
      setError("This member invitation is missing its secure token.");
      return;
    }
    void api
      .memberInvitation(token)
      .then(setInvitation)
      .catch((cause: Error) => setError(cause.message));
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.activateMember(token, password);
      await navigate({ to: "/wallet" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-header">
        <BrandMark />
        <Link to="/" className="back-link">
          Back to site
        </Link>
      </header>
      <main className="auth-main">
        <section className="auth-card">
          <span className="auth-icon">
            <UserRoundCheck />
          </span>
          <span className="section-kicker">Member activation</span>
          <h1>Activate your Elite Rewards wallet</h1>
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
              <label>
                Create member password
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
                Confirm password
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
                {busy ? "Activating…" : "Activate member wallet"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
