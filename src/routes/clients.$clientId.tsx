import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Gift, LogIn, ScanLine, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { BusinessBrand } from "@/components/BusinessBrand";
import { api, type PublicClientExperience } from "@/lib/api-client";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({ meta: [{ title: "Rewards program | Elite Rewards" }] }),
  component: ClientExperience,
});

function ClientExperience() {
  const { clientId } = Route.useParams();
  const [data, setData] = useState<PublicClientExperience | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .publicClient(clientId)
      .then(setData)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Client rewards page unavailable");
      });
  }, [clientId]);
  if (error) return <div className="status-screen">{error}</div>;
  if (!data) return <div className="status-screen">Loading rewards program…</div>;
  const style = {
    "--client-primary": data.business.primary_color,
    "--client-secondary": data.business.secondary_color,
  } as React.CSSProperties;
  return (
    <div className="client-public-page" style={style}>
      <header className="client-public-header container-mid">
        <BusinessBrand business={data.business} />
        <Link to="/login" className="button button-dark">
          <LogIn size={17} /> Member sign in
        </Link>
      </header>
      <main className="client-public-main container-mid">
        <section className="client-public-hero">
          <span className="eyebrow">
            <Sparkles size={14} /> Loyalty rewards
          </span>
          <h1>Earn more every time you return.</h1>
          <p>
            Join {data.business.business_name} rewards, collect points, and unlock offers selected
            by this business.
          </p>
          <div className="client-public-actions">
            <Link to="/login" className="button button-primary">
              Open member wallet <ArrowRight size={18} />
            </Link>
            <span>
              <ScanLine size={18} /> NFC card destination
            </span>
          </div>
        </section>
        <section className="client-public-rewards">
          <div>
            <span className="section-kicker">Available offers</span>
            <h2>Rewards worth coming back for</h2>
          </div>
          <div className="reward-grid">
            {data.rewards.map((reward, index) => (
              <article
                className={`reward-card ${["champagne", "gold", "amber"][index % 3]}`}
                key={reward.id}
              >
                <span className="reward-card-icon">
                  <Gift />
                </span>
                <span className="reward-cost">{reward.points.toLocaleString()} pts</span>
                <h3>{reward.name}</h3>
                <p>{reward.description}</p>
              </article>
            ))}
            {!data.rewards.length && <p>No rewards are published right now.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
