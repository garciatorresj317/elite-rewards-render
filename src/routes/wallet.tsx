import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronRight, Gift, History, QrCode, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { rewards } from "@/data/rewards";
import { applyDemoRedemption, readWallet } from "@/lib/demo-storage";
import type { Redemption } from "@/lib/rewards-engine";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "My wallet | Elite Rewards" },
      {
        name: "description",
        content: "View points, rewards, and activity in the Elite Rewards member wallet.",
      },
    ],
  }),
  component: Wallet,
});

function Wallet() {
  const [points, setPoints] = useState(1240);
  const [claimed, setClaimed] = useState<string[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const state = readWallet();
    setPoints(state.points);
    setClaimed(state.claimed);
    setRedemptions(state.redemptions);
  }, []);
  const redeem = (id: string, cost: number, name: string) => {
    if (points < cost || claimed.includes(id)) return;
    const reward = rewards.find((item) => item.id === id);
    if (!reward) return;
    const redeemedAt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
    const result = applyDemoRedemption(reward, redeemedAt, crypto.randomUUID());
    if (!result.ok) return;
    setPoints(result.wallet.points);
    setClaimed(result.wallet.claimed);
    setRedemptions(result.wallet.redemptions);
    setNotice(
      result.saved
        ? `${name} is ready to use.`
        : `${name} was redeemed for this session, but this browser blocked saving it.`,
    );
    setTimeout(() => setNotice(""), 3500);
  };
  return (
    <div className="wallet-page">
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <Check size={18} />
          {notice}
        </div>
      )}
      <header className="wallet-header container-mid">
        <BrandMark />
        <Link to="/" className="back-link">
          <ArrowLeft size={17} /> Back to site
        </Link>
      </header>
      <main className="container-mid wallet-layout">
        <section className="member-summary">
          <div>
            <span className="eyebrow">
              <Sparkles size={14} /> Your member wallet
            </span>
            <h1>
              Welcome back, <em>Maya.</em>
            </h1>
            <p>Every visit brings your next favorite reward closer.</p>
          </div>
          <div className="points-orb">
            <small>Available balance</small>
            <strong>{points.toLocaleString()}</strong>
            <span>points</span>
          </div>
        </section>
        <section className="next-reward-card">
          <div>
            <span className="reward-glyph">
              <Gift />
            </span>
            <div>
              <small>Next milestone</small>
              <h2>
                {points >= 1400
                  ? "You made it."
                  : `${Math.max(0, 1400 - points)} points until $20 off`}
              </h2>
            </div>
          </div>
          <div className="reward-progress">
            <span style={{ width: `${Math.min(100, (points / 1400) * 100)}%` }} />
          </div>
          <div className="reward-scale">
            <span>0</span>
            <span>1,400 points</span>
          </div>
        </section>
        <div className="wallet-section-title">
          <div>
            <span className="section-kicker">Choose your perk</span>
            <h2>Rewards for you</h2>
          </div>
          <button className="text-button" onClick={() => setHistoryOpen(true)}>
            <History size={17} /> Reward history
          </button>
        </div>
        <section className="reward-grid">
          {rewards.map((reward) => {
            const disabled = points < reward.points || claimed.includes(reward.id);
            return (
              <article className={`reward-card ${reward.accent}`} key={reward.id}>
                <span className="reward-card-icon">
                  <Gift />
                </span>
                <span className="reward-cost">{reward.points} pts</span>
                <h3>{reward.name}</h3>
                <p>{reward.description}</p>
                <button
                  disabled={disabled}
                  onClick={() => redeem(reward.id, reward.points, reward.name)}
                >
                  {claimed.includes(reward.id)
                    ? "Added to wallet"
                    : points < reward.points
                      ? "Keep earning"
                      : "Redeem"}
                  <ChevronRight size={17} />
                </button>
              </article>
            );
          })}
        </section>
        <section className="scan-panel">
          <div>
            <span className="scan-icon">
              <QrCode />
            </span>
            <div>
              <h3>Earn on your next visit</h3>
              <p>Show your member code at checkout to collect points.</p>
            </div>
          </div>
          <button onClick={() => setNotice("Member code: ELITE-2849-MAYA")}>
            Show member code
          </button>
        </section>
      </main>
      {historyOpen && (
        <div className="modal-backdrop" onMouseDown={() => setHistoryOpen(false)}>
          <div
            className="award-modal history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setHistoryOpen(false)}
              aria-label="Close reward history"
            >
              <X />
            </button>
            <span className="modal-icon">
              <History />
            </span>
            <span className="section-kicker">Demonstration ledger</span>
            <h2 id="history-modal-title">Reward history</h2>
            {redemptions.length === 0 ? (
              <p>No rewards redeemed yet. Your demonstration redemptions will appear here.</p>
            ) : (
              <ul className="history-list">
                {redemptions.map((item) => (
                  <li key={`${item.rewardId}-${item.redeemedAt}`}>
                    <span>
                      <strong>{item.rewardName}</strong>
                      <small>{item.redeemedAt}</small>
                    </span>
                    <b>−{item.points} pts</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
