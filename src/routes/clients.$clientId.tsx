import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Gift, LogIn, PackageOpen, ScanLine, Sparkles, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { BusinessBrand } from "@/components/BusinessBrand";
import { useI18n } from "@/i18n";
import { api, type PublicClientExperience } from "@/lib/api-client";
export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({ meta: [{ title: "Rewards program | Elite Rewards" }] }),
  component: ClientExperience,
});
function ClientExperience() {
  const { clientId } = Route.useParams();
  const { t, formatNumber, errorMessage } = useI18n();
  const [data, setData] = useState<PublicClientExperience | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api
      .publicClient(clientId)
      .then(setData)
      .catch((cause) => setError(errorMessage(cause, "Client rewards page unavailable")));
  }, [clientId, errorMessage]);
  if (error) return <div className="status-screen">{error}</div>;
  if (!data) return <div className="status-screen">{t("Loading rewards program…")}</div>;
  const style = {
    "--client-primary": data.business.primary_color,
    "--client-secondary": data.business.secondary_color,
  } as React.CSSProperties;
  return (
    <div className="client-public-page" style={style}>
      <header className="client-public-header container-mid">
        <BusinessBrand business={data.business} />
        <Link to="/login" className="button button-dark">
          <LogIn size={17} /> {t("Member sign in")}
        </Link>
      </header>
      <main className="client-public-main container-mid">
        <section className="client-public-hero">
          <span className="eyebrow">
            <Sparkles size={14} /> {t("Loyalty rewards")}
          </span>
          <h1>{t("Earn more every time you return.")}</h1>
          <p>
            {t(
              "Join {businessName} rewards, collect points, and unlock offers selected by this business.",
              { businessName: data.business.business_name },
            )}
          </p>
          <div className="client-public-actions">
            <a
              href={`/join?business=${encodeURIComponent(clientId)}`}
              className="button button-primary"
            >
              <UserPlus size={18} /> {t("Join Rewards")}
            </a>
            <Link to="/login" className="button button-primary">
              {t("Open member wallet")} <ArrowRight size={18} />
            </Link>
            <span>
              <ScanLine size={18} /> {t("NFC card destination")}
            </span>
          </div>
        </section>
        <section className="client-public-rewards">
          <div>
            <span className="section-kicker">{t("Available offers")}</span>
            <h2>{t("Rewards worth coming back for")}</h2>
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
                <span className="reward-cost">
                  {formatNumber(reward.points)} {t("pts")}
                </span>
                <h3>{reward.name}</h3>
                <p>{reward.description}</p>
              </article>
            ))}
            {!data.rewards.length && <p>{t("No rewards are published right now.")}</p>}
          </div>
        </section>
        <section className="client-public-products">
          <div>
            <span className="section-kicker">{t("Business products")}</span>
            <h2>{t("Explore what this business offers")}</h2>
          </div>
          <div className="product-grid">
            {data.products.map((product) => (
              <article className="product-card" key={product.id}>
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="product-placeholder">
                    <PackageOpen />
                  </span>
                )}
                <div>
                  {product.category && <small>{product.category}</small>}
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  {product.priceCents > 0 && (
                    <strong>
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "USD",
                      }).format(product.priceCents / 100)}
                    </strong>
                  )}
                  {product.purchaseUrl && (
                    <a href={product.purchaseUrl} target="_blank" rel="noreferrer">
                      {t("View product")} <ArrowRight size={16} />
                    </a>
                  )}
                </div>
              </article>
            ))}
            {!data.products.length && <p>{t("No products are published right now.")}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
