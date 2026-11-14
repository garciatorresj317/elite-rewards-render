import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  Gift,
  HeartHandshake,
  Palette,
  QrCode,
  RefreshCcw,
  Share2,
  Sparkles,
  Phone,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { useI18n } from "@/i18n";
import { isStandaloneDisplay } from "@/lib/pwa";
import { useEffect } from "react";

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
  const navigate = useNavigate();
  const { t, formatNumber, formatDateTime } = useI18n();
  useEffect(() => {
    if (isStandaloneDisplay()) {
      void navigate({ to: "/admin", replace: true });
    }
  }, [navigate]);
  const howItWorks = [
    {
      icon: QrCode,
      title: t("Join in seconds"),
      copy: t(
        "Give customers a permanent Join Rewards link or NFC card. They create a private member wallet in English or Spanish without downloading an app.",
      ),
    },
    {
      icon: Palette,
      title: t("Built around your brand"),
      copy: t(
        "Make the experience feel like your business with your logo, colors, business motto or live message, products, and reward offers across customer and member pages.",
      ),
    },
    {
      icon: RefreshCcw,
      title: t("Choose points or visits"),
      copy: t(
        "Run the loyalty model that fits your business. Award points for eligible purchases or count visits toward rewards, then set each offer's required value.",
      ),
    },
    {
      icon: Share2,
      title: t("Grow through referrals"),
      copy: t(
        "Use member referrals when they fit your strategy. Members can share a personal link with friends and family, helping your program reach new customers.",
      ),
    },
  ];
  const teamBenefits = [
    t("One organized place to manage members, balances, rewards, products, and client branding."),
    t("A consistent branded experience from the first scan to the member wallet and redemption."),
    t("Flexible program controls that can change as your business and customer strategy evolve."),
    t("Clear activity and redemption records that help your team serve members with confidence."),
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
            <span className="section-kicker">{t("Designed around your business")}</span>
            <h2>{t("Your brand. Your rewards. Your way to build loyalty.")}</h2>
          </div>
          <p>
            {t(
              "Elite Rewards becomes the digital loyalty side of your team. We give your business one customizable system for attracting members, rewarding repeat customers, and keeping the entire experience organized.",
            )}
          </p>
        </section>
        <section
          className="feature-grid how-it-works-grid container-wide"
          aria-label={t("How Elite Rewards works")}
        >
          {howItWorks.map(({ icon: Icon, title: featureTitle, copy }, index) => (
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
        <section id="features" className="team-benefits container-wide">
          <div className="team-benefits-copy">
            <span className="eyebrow light">
              <HeartHandshake size={14} /> {t("More than a rewards page")}
            </span>
            <h2>{t("Add a loyalty system your whole team can use.")}</h2>
            <p>
              {t(
                "Elite Rewards connects your customer sign-up, branded member experience, rewards, referrals, and activity records so your staff can spend less time juggling separate tools and more time building customer relationships.",
              )}
            </p>
          </div>
          <ul className="team-benefit-list">
            {teamBenefits.map((benefit) => (
              <li key={benefit}>
                <span>
                  <Check size={17} />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </section>
        <section className="cta-panel container-wide">
          <div>
            <span className="eyebrow light">
              <BarChart3 size={14} /> {t("Built to grow with you")}
            </span>
            <h2>
              {t("Start simple, then shape the program around what your customers respond to.")}
            </h2>
            <p>
              {t(
                "Change branding, choose points or visits, publish rewards and products, and manage referrals from one business dashboard while every member keeps a secure, business-specific wallet.",
              )}
            </p>
          </div>
        </section>
      </main>
      <footer className="site-footer container-wide">
        <BrandMark compact />
        <div className="site-footer-copy">
          <p>{t("Thoughtful loyalty tools for growing businesses.")}</p>
          <p>{t("Trade Marked and Registered LLC")}</p>
        </div>
        <a
          className="site-footer-contact"
          href="tel:+14074051726"
          aria-label={t("Call Mike at 407-405-1726")}
        >
          <span className="site-footer-contact-icon" aria-hidden="true">
            <Phone size={22} />
          </span>
          <span>
            <small>{t("Interested? Contact Mike")}</small>
            <strong className="site-footer-contact-number">407-405-1726</strong>
            <em>{t("Tap to call")}</em>
          </span>
        </a>
        <span>© 2026 Elite Rewards</span>
      </footer>
    </div>
  );
}
