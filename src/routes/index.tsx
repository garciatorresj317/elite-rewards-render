import { createFileRoute, Link } from "@tanstack/react-router";
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

const features = [
  {
    icon: QrCode,
    title: "Join in seconds",
    copy: "One scan. No app download. Members start earning before they leave the counter.",
  },
  {
    icon: Gift,
    title: "Rewards they want",
    copy: "Build flexible offers around visits, points, birthdays, or your best-selling items.",
  },
  {
    icon: BarChart3,
    title: "Know what works",
    copy: "See member growth, repeat visits, redemptions, and eligible sales in one clear view.",
  },
];

function Home() {
  return (
    <div className="marketing-shell">
      <header className="site-header container-wide">
        <BrandMark />
        <nav aria-label="Primary navigation">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="header-actions">
          <Link to="/wallet" className="text-link">
            Member demo
          </Link>
          <Link to="/admin" className="button button-dark">
            Open dashboard
          </Link>
        </div>
      </header>

      <main>
        <section className="hero container-wide">
          <div className="hero-copy">
            <span className="eyebrow">
              <Sparkles size={14} /> Loyalty, made human
            </span>
            <h1>
              Turn a first visit into a <em>favorite habit.</em>
            </h1>
            <p>
              Elite Rewards gives growing businesses a simple way to recognize their best customers,
              reward real loyalty, and bring people back.
            </p>
            <div className="hero-actions">
              <Link to="/admin" className="button button-primary">
                Explore the dashboard <ArrowRight size={18} />
              </Link>
              <Link to="/wallet" className="button button-ghost">
                See the member view
              </Link>
            </div>
            <div className="hero-proof">
              <span>
                <Check size={16} /> No app required
              </span>
              <span>
                <Check size={16} /> Interactive preview
              </span>
              <span>
                <Check size={16} /> Production services pending
              </span>
            </div>
          </div>
          <div className="hero-visual" aria-label="Elite Rewards member wallet preview">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="wallet-preview">
              <div className="wallet-top">
                <BrandMark compact />
                <span className="status-pill">Member</span>
              </div>
              <p>Good afternoon, Maya</p>
              <h2>
                1,240 <small>points</small>
              </h2>
              <div className="progress-track">
                <span style={{ width: "78%" }} />
              </div>
              <div className="progress-caption">
                <span>160 points to go</span>
                <strong>$15 reward</strong>
              </div>
              <div className="reward-ticket">
                <span className="ticket-icon">
                  <Gift />
                </span>
                <span>
                  <small>Ready to use</small>
                  <strong>$5 off your next visit</strong>
                </span>
                <button>Use reward</button>
              </div>
              <div className="mini-stats">
                <span>
                  <strong>8</strong>
                  <small>visits</small>
                </span>
                <span>
                  <strong>3</strong>
                  <small>rewards</small>
                </span>
                <span>
                  <strong>Nov 18</strong>
                  <small>member since</small>
                </span>
              </div>
            </div>
            <div className="floating-note note-one">
              <Users size={18} />
              <span>
                <strong>+126</strong> new members
              </span>
            </div>
            <div className="floating-note note-two">
              <HeartHandshake size={18} />
              <span>
                <strong>72%</strong> return rate
              </span>
            </div>
          </div>
        </section>

        <section className="trust-strip">
          <p>Built for the businesses people return to</p>
          <div>
            <span>CAFÉS</span>
            <span>BOUTIQUES</span>
            <span>SALONS</span>
            <span>STUDIOS</span>
            <span>LOCAL RETAIL</span>
          </div>
        </section>

        <section id="how" className="section container-wide intro-section">
          <div>
            <span className="section-kicker">Simple by design</span>
            <h2>Reward loyalty without adding more work.</h2>
          </div>
          <p>
            From sign-up to redemption, every part of Elite Rewards is designed to feel effortless
            for your team and your customers.
          </p>
        </section>

        <section id="features" className="feature-grid container-wide">
          {features.map(({ icon: Icon, title, copy }, index) => (
            <article key={title}>
              <span className="feature-number">0{index + 1}</span>
              <span className="feature-icon">
                <Icon />
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </section>

        <section id="pricing" className="cta-panel container-wide">
          <div>
            <span className="eyebrow light">
              <Sparkles size={14} /> A better reason to return
            </span>
            <h2>Make every customer feel like a regular.</h2>
            <p>
              Preview the business dashboard and member experience with interactive demonstration
              data while production services are being connected.
            </p>
          </div>
          <Link to="/admin" className="button button-light">
            Launch Elite Rewards <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <footer className="site-footer container-wide">
        <BrandMark compact />
        <p>Thoughtful loyalty tools for growing businesses.</p>
        <span>© 2026 Elite Rewards</span>
      </footer>
    </div>
  );
}
