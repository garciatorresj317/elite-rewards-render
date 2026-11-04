import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Initial setup | Elite Rewards" }] }),
  component: Setup,
});

const initial = {
  setupToken: "",
  businessName: "Elite Rewards Business",
  locationName: "Primary location",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  memberName: "Maya Thompson",
  memberEmail: "",
  memberPassword: "",
};
function Setup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api
      .setupStatus()
      .then((x) => setAllowed(x.setupRequired))
      .catch((e: Error) => setError(e.message));
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.setup(form);
      await navigate({ to: "/admin" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  };
  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        required
        minLength={type === "password" ? 12 : 2}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
    </label>
  );
  return (
    <div className="auth-page">
      <header className="wallet-header container-mid">
        <BrandMark />
      </header>
      <main className="auth-card setup-card">
        <span className="modal-icon">
          <ShieldCheck />
        </span>
        <span className="section-kicker">One-time production setup</span>
        <h1>{allowed === false ? "Setup is complete" : "Create the first live program"}</h1>
        {allowed === false ? (
          <p>The one-time setup route is closed. Sign in with an existing account.</p>
        ) : (
          <>
            <p>
              This creates one business, one location, the owner account, and the first member. It
              cannot be run twice.
            </p>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <form onSubmit={submit} className="setup-grid">
              {field("setupToken", "Deployment setup token", "password")}
              {field("businessName", "Business name")}
              {field("locationName", "Location name")}
              {field("ownerName", "Owner name")}
              {field("ownerEmail", "Owner email", "email")}
              {field("ownerPassword", "Owner password", "password")}
              {field("memberName", "First member name")}
              {field("memberEmail", "First member email", "email")}
              {field("memberPassword", "Member password", "password")}
              <button className="admin-primary full" disabled={busy}>
                {busy ? "Creating…" : "Create production program"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
