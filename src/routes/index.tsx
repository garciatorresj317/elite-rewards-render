import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  Gift,
  HeartHandshake,
  QrCode,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useI18n } from "@/i18n";

const title = "Elite Rewards | Loyalty that feels personal";
const description =
  "A modern rewards program that helps local businesses turn everyday customers into loyal regulars.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, formatNumber, formatDateTime } = useI18n();
  const features = [
    {
      icon: QrCode,
      title: t("Join in seconds"),
      copy: t("One scan. No app download. Members start earning before they leave the counter."),
    },
    {
      icon: Gift,
      title: t("Rewards they want"),
      copy: t(
        "Build flexible offers around visits, points, birthdays, or your best-selling items.",
      ),
    },
    {
      icon: BarChart3,
      title: t("Know what works"),
      copy: t(
        "See member growth, repeat visits, redemptions, and eligible sales in one clear view.",
      ),
    },
  ];
  return (
    <div className="marketing-shell">
      <header className="site-header container-wide">
        <BrandMark />
        <nav aria-label={t("Primary navigation")}>
          <a href="#how">{t("How it works")}</a>
          <a href="#features">{t("Features")}</a>
        </nav>
      </header>
      <main>
        <section className="hero container-wide">
          <div className="hero-copy">
            <span className="eyebrow">
              <Sparkles size={14} /> {t("Loyalty, made human")}
            </span>
            <h1>
              {t("Turn a first visit into a")} <em>{t("favorite habit.")}</em>
            </h1>
            <p>
              {t(
                "Elite Rewards gives growing businesses a simple way to recognize their best customers, reward real loyalty, and bring people back.",
              )}
            </p>
            <div className="hero-actions">
              <a href="#how" className="button button-primary">
                {t("How it works")} <ArrowRight size={18} />
              </a>
              <a href="#features" className="button button-ghost">
                {t("Features")}
              </a>
            </div>
            <div className="hero-proof">
              <span>
                <Check size={16} /> {t("No app required")}
              </span>
              <span>
                <Check size={16} /> {t("Secure member access")}
              </span>
              <span>
                <Check size={16} /> {t("Server-backed rewards ledger")}
              </span>
            </div>
          </div>
          <div className="hero-visual" aria-label={t("Elite Rewards member wallet preview")}>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="wallet-preview">
              <div className="wallet-top">
                <BrandMark compact />
                <span className="status-pill">{t("Member")}</span>
              </div>
              <p>{t("Good afternoon, Maya")}</p>
              <h2>
                {formatNumber(1240)} <small>{t("points")}</small>
              </h2>
              <div className="progress-track">
                <span style={{ width: "78%" }} />
              </div>
              <div className="progress-caption">
                <span>{t("160 points to go")}</span>
                <strong>{t("$15 reward")}</strong>
              </div>
              <div className="reward-ticket" aria-hidden="true">
                <span className="ticket-icon">
                  <Gift />
                </span>
                <span>
                  <small>{t("Ready to use")}</small>
                  <strong>{t("$5 off your next visit")}</strong>
                </span>
                <span className="reward-preview-action">{t("Use reward")}</span>
              </div>
              <div className="mini-stats">
                <span>
                  <strong>8</strong>
                  <small>{t("visits")}</small>
                </span>
                <span>
                  <strong>3</strong>
                  <small>{t("rewards")}</small>
                </span>
                <span>
                  <strong>
                    {formatDateTime(new Date(2025, 10, 18), { month: "short", day: "numeric" })}
                  </strong>
                  <small>{t("member since")}</small>
                </span>
              </div>
            </div>
            <div className="floating-note note-one">
              <Users size={18} />
              <span>
                <strong>+126</strong> {t("new members")}
              </span>
            </div>
            <div className="floating-note note-two">
              <HeartHandshake size={18} />
              <span>
                <strong>72%</strong> {t("return rate")}
              </span>
            </div>
          </div>
        </section>
        <section className="trust-strip">
          <p>{t("Built for the businesses people return to")}</p>
          <div>
            <span>{t("CAFÉS")}</span>
            <span>{t("BOUTIQUES")}</span>
            <span>{t("SALONS")}</span>
            <span>{t("STUDIOS")}</span>
            <span>{t("LOCAL RETAIL")}</span>
          </div>
        </section>
        <section id="how" className="section container-wide intro-section">
          <div>
            <span className="section-kicker">{t("Simple by design")}</span>
            <h2>{t("Reward loyalty without adding more work.")}</h2>
          </div>
          <p>
            {t(
              "From sign-up to redemption, every part of Elite Rewards is designed to feel effortless for your team and your customers.",
            )}
          </p>
        </section>
        <section id="features" className="feature-grid container-wide">
          {features.map(({ icon: Icon, title: featureTitle, copy }, index) => (
            <article key={featureTitle}>
              <span className="feature-number">0{index + 1}</span>
              <span className="feature-icon">
                <Icon />
              </span>
              <h3>{featureTitle}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </section>
        <section className="cta-panel container-wide">
          <div>
            <span className="eyebrow light">
              <Sparkles size={14} /> {t("A better reason to return")}
            </span>
            <h2>{t("Make every customer feel like a regular.")}</h2>
            <p>
              {t(
                "Elite Rewards keeps member activity, eligible purchases, and redemptions organized in one authoritative rewards ledger.",
              )}
            </p>
          </div>
        </section>
      </main>
      <footer className="site-footer container-wide">
        <BrandMark compact />
        <p>{t("Thoughtful loyalty tools for growing businesses.")}</p>
        <span>© 2026 Elite Rewards</span>
      </footer>
    </div>
  );
}
