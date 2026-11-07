import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useI18n } from "@/i18n";
import { api, type SessionUser } from "@/lib/api-client";

type LoginSearch = { access?: "member" };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch =>
    search["access"] === "member" ? { access: "member" } : {},
  head: () => ({ meta: [{ title: "Sign in | Elite Rewards" }] }),
  component: Login,
});
function Login() {
  const navigate = useNavigate();
  const { access } = Route.useSearch();
  const memberAccess = access === "member";
  const { t, errorMessage } = useI18n();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [setupRequired, setSetupRequired] = useState(false),
    [activeBusinessUser, setActiveBusinessUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    void Promise.all([api.session(), api.setupStatus()])
      .then(([session, setup]) => {
        setSetupRequired(setup.setupRequired);
        if (!session.user) return;
        if (session.user.role === "member") {
          void navigate({ to: "/wallet" });
          return;
        }
        if (memberAccess) {
          setActiveBusinessUser(session.user);
          return;
        }
        void navigate({ to: "/admin" });
      })
      .catch((cause) => setError(errorMessage(cause, "Sign in failed")));
  }, [navigate, errorMessage, memberAccess]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.login(email, password);
      if (memberAccess && result.user.role !== "member") {
        await api.logout();
        setError(t("This sign-in is for member wallets. Use a member account."));
        return;
      }
      await navigate({ to: result.user.role === "member" ? "/wallet" : "/admin" });
    } catch (cause) {
      setError(errorMessage(cause, "Sign in failed"));
    } finally {
      setBusy(false);
    }
  };
  const switchToMember = async () => {
    setBusy(true);
    setError("");
    try {
      await api.logout();
      setActiveBusinessUser(null);
    } catch (cause) {
      setError(errorMessage(cause, "Sign out failed"));
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
        <h1>{t(memberAccess ? "Sign in to your member wallet" : "Sign in to Elite Rewards")}</h1>
        <p>
          {t(
            memberAccess
              ? "Use the member email and password created for this rewards program."
              : "Use your business or member account. Rewards balances are stored in the production ledger.",
          )}
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {activeBusinessUser ? (
          <div className="member-account-switch">
            <p>
              {t("A business account is currently signed in as {name}.", {
                name: activeBusinessUser.name,
              })}
            </p>
            <button className="admin-primary full" disabled={busy} onClick={switchToMember}>
              {t("Sign out and continue as a member")}
            </button>
            <Link to="/admin" className="button button-ghost full">
              {t("Return to business dashboard")}
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
              {busy ? t("Signing in…") : t(memberAccess ? "Open member wallet" : "Sign in")}
            </button>
          </form>
        )}
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
