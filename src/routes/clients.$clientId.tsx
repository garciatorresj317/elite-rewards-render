import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Gift, LogIn, PackageOpen, ScanLine, Sparkles, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { BusinessBrand } from "@/components/BusinessBrand";
import { ExperienceBackdrop } from "@/components/ExperienceTheme";
import { PageStatus } from "@/components/PageStatus";
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
    [error, setError] = useState(""),
    [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    setError("");
    setData(null);
    api
      .publicClient(clientId)
      .then(setData)
      .catch((cause) => setError(errorMessage(cause, "Client rewards page unavailable")));
  }, [clientId, errorMessage, reloadKey]);
  if (error)
    return (
      <PageStatus
        title={t("Rewards program unavailable")}
        message={error}
        retryLabel={t("Try again")}
        onRetry={() => setReloadKey((value) => value + 1)}
        action={
          <Link to="/" className="button button-ghost">
            {t("Return home")}
          </Link>
        }
      />
    );
  if (!data) return <PageStatus title={t("Loading rewards program…")} loading />;
  const style = {
    "--client-primary": data.business.primary_color,
    "--client-secondary": data.business.secondary_color,
  } as React.CSSProperties;
  return (
    <div className={`client-public-page theme-${data.visualSettings.themeKey}`} style={style}>
      <ExperienceBackdrop settings={data.visualSettings} audience="member" />
      <header className="client-public-header container-mid themed-surface-content">
        <BusinessBrand business={data.business} />
        <a href="/login?access=member" className="button button-dark">
          <LogIn size={17} /> {t("Member sign in")}
        </a>
      </header>
      <main className="client-public-main container-mid themed-surface-content">
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
            <Link to="/join" search={{ business: clientId }} className="button button-primary">
              <UserPlus size={18} /> {t("Join Rewards")}
            </Link>
            <a href="/login?access=member" className="button button-primary">
              {t("Open member wallet")} <ArrowRight size={18} />
            </a>
            <span>
              <ScanLine size={18} /> {t("No app required")}
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
        {data.products.length > 0 && (
          <section className="client-public-products">
            <div>
              <span className="section-kicker">{t("Business products")}</span>
              <h2>{t("Explore what this business offers")}</h2>
            </div>
            <div className="product-grid">
              {data.products.map((product) => (
                <article className="product-card" key={product.id}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} loading="lazy" />
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
                    {product.pointsCost > 0 && (
                      <span className="product-points">
                        {formatNumber(product.pointsCost)} {t("points")}
                      </span>
                    )}
                    {product.purchaseUrl && (
                      <a href={product.purchaseUrl} target="_blank" rel="noreferrer">
                        {t("View product")} <ArrowRight size={16} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
