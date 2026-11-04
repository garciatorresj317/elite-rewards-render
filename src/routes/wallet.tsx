import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Copy,
  Gift,
  History,
  LogOut,
  QrCode,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ExperienceBackdrop } from "@/components/ExperienceTheme";
import { api, type VisualSettings, type WalletData } from "@/lib/api-client";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "My wallet | Elite Rewards" }] }),
  component: Wallet,
});
function Wallet() {
  const navigate = useNavigate();
  const [data, setData] = useState<WalletData | null>(null),
    [busy, setBusy] = useState(true),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [historyOpen, setHistoryOpen] = useState(false),
    [codeOpen, setCodeOpen] = useState(false),
    [referral, setReferral] = useState<{ sharePath: string; referralCount: number } | null>(null),
    [settings, setSettings] = useState<VisualSettings | null>(null);
  const load = useCallback(async () => {
    try {
      const session = await api.session();
      if (!session.user || session.user.role !== "member") {
        await navigate({ to: "/login" });
        return;
      }
      const [wallet, visualSettings] = await Promise.all([api.wallet(), api.visualSettings()]);
      setData(wallet);
      setSettings(visualSettings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet failed to load");
    } finally {
      setBusy(false);
    }
  }, [navigate]);
  useEffect(() => {
    void load();
  }, [load]);
  const redeem = async (rewardId: string, name: string) => {
    setError("");
    try {
      const result = await api.redeem(rewardId);
      setNotice(`${name} redeemed. Code: ${result.code}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Redemption failed");
    }
  };
  const logout = async () => {
    await api.logout();
    await navigate({ to: "/login" });
  };
  const loadReferral = async () => {
    try {
      setReferral(await api.referral());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Referral link unavailable");
    }
  };
  if (busy) return <Status label="Loading secure wallet…" />;
  if (!data) return <Status label={error || "Wallet unavailable."} />;
  const next = Math.min(
    ...data.rewards.map((reward) => reward.points).filter((points) => points > data.points),
    data.points || 500,
  );
  return (
    <div className={`wallet-page theme-${settings?.themeKey ?? "elite-signature"}`}>
      <ExperienceBackdrop settings={settings} audience="member" />
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      <header className="wallet-header container-mid">
        <BrandMark />
        <button className="back-link plain-button" onClick={logout}>
          <LogOut size={17} /> Sign out
        </button>
      </header>
      <main className="container-mid wallet-layout">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <section className="member-summary">
          <div>
            <span className="eyebrow">
              <Sparkles size={14} /> {data.context?.business_name}
            </span>
            <h1>
              Welcome back, <em>{data.member.name.split(" ")[0]}.</em>
            </h1>
            <p>Your balance is authoritative and updates from the live rewards ledger.</p>
          </div>
          <div className="points-orb">
            <small>Available balance</small>
            <strong>{data.points.toLocaleString()}</strong>
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
                {data.points >= next
                  ? "A reward is ready."
                  : `${next - data.points} points until your next reward`}
              </h2>
            </div>
          </div>
          <div className="reward-progress">
            <span style={{ width: `${Math.min(100, (data.points / next) * 100)}%` }} />
          </div>
          <div className="reward-scale">
            <span>0</span>
            <span>{next.toLocaleString()} points</span>
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
          {data.rewards.map((reward, index) => {
            const disabled = data.points < reward.points;
            return (
              <article
                className={`reward-card ${["champagne", "gold", "amber"][index % 3]}`}
                key={reward.id}
              >
                <span className="reward-card-icon">
                  <Gift />
                </span>
                <span className="reward-cost">{reward.points} pts</span>
                <h3>{reward.name}</h3>
                <p>{reward.description}</p>
                <button disabled={disabled} onClick={() => void redeem(reward.id, reward.name)}>
                  {disabled ? "Keep earning" : "Redeem"}
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
              <p>Show your unique member code at checkout.</p>
            </div>
          </div>
          <button onClick={() => setCodeOpen(true)}>Show member code</button>
        </section>
        <section className="referral-panel panel">
          <div>
            <span className="scan-icon">
              <Share2 />
            </span>
            <div>
              <span className="section-kicker">Invite friends & family</span>
              <h3>Share your rewards link</h3>
              <p>
                Friends can use your secure link to create a wallet for{" "}
                {data.context?.business_name}.
              </p>
            </div>
          </div>
          {referral ? (
            <div className="referral-share">
              <code>{`${window.location.origin}${referral.sharePath}`}</code>
              <button
                onClick={() =>
                  void navigator.clipboard.writeText(
                    `${window.location.origin}${referral.sharePath}`,
                  )
                }
              >
                <Copy size={17} /> Copy link
              </button>
              <small>
                {referral.referralCount} joined referral{referral.referralCount === 1 ? "" : "s"}
              </small>
            </div>
          ) : (
            <button onClick={() => void loadReferral()}>Create my referral link</button>
          )}
        </section>
        {data.redemptions.length > 0 && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <span>
                  <Gift />
                </span>
                <h3>Active reward codes</h3>
              </div>
            </div>
            <ul className="history-list">
              {data.redemptions
                .filter((x) => x.status === "active")
                .map((x) => (
                  <li key={x.id}>
                    <span>
                      <strong>{x.name}</strong>
                      <small>{new Date(x.created_at).toLocaleString()}</small>
                    </span>
                    <b>{x.code}</b>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </main>
      {historyOpen && (
        <Modal title="Reward history" close={() => setHistoryOpen(false)}>
          <ul className="history-list">
            {data.ledger.length ? (
              data.ledger.map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>{item.reward_name ?? item.note}</strong>
                    <small>{new Date(item.created_at).toLocaleString()}</small>
                  </span>
                  <b>
                    {item.pointsDelta > 0 ? "+" : ""}
                    {item.pointsDelta} pts
                  </b>
                </li>
              ))
            ) : (
              <li>No activity yet.</li>
            )}
          </ul>
        </Modal>
      )}
      {codeOpen && (
        <Modal title="Member code" close={() => setCodeOpen(false)}>
          <div className="member-code">{data.member.memberCode}</div>
          <p>Only show this code to authorized staff at {data.context?.location_name}.</p>
        </Modal>
      )}
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="award-modal history-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={close} aria-label="Close">
          <X />
        </button>
        <span className="modal-icon">
          <History />
        </span>
        <span className="section-kicker">Live account</span>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Status({ label }: { label: string }) {
  return (
    <div className="error-screen">
      <div>
        <BrandMark />
        <h1>{label}</h1>
        <a className="button button-dark" href="/login">
          Go to sign in
        </a>
      </div>
    </div>
  );
}
