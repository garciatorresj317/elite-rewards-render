import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in | Elite Rewards" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  useEffect(() => {
    void Promise.all([api.session(), api.setupStatus()])
      .then(([session, setup]) => {
        setSetupRequired(setup.setupRequired);
        if (session.user)
          void navigate({ to: session.user.role === "member" ? "/wallet" : "/admin" });
      })
      .catch((cause: Error) => setError(cause.message));
  }, [navigate]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.login(email, password);
      await navigate({ to: result.user.role === "member" ? "/wallet" : "/admin" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <header className="wallet-header container-mid">
        <BrandMark />
        <Link to="/" className="back-link">
          <ArrowLeft size={17} /> Back to site
        </Link>
      </header>
      <main className="auth-card">
        <span className="modal-icon">
          <LockKeyhole />
        </span>
        <span className="section-kicker">
          <Sparkles size={14} /> Secure access
        </span>
        <h1>Sign in to Elite Rewards</h1>
        <p>
          Use your business or member account. Rewards balances are stored in the production ledger.
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
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
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {setupRequired && (
          <p className="auth-note">
            Initial setup is required. Open the private setup page and use the deployment setup
            token.
          </p>
        )}
      </main>
    </div>
  );
}
