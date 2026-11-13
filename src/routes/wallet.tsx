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
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BusinessBrand } from "@/components/BusinessBrand";
import { ExperienceBackdrop } from "@/components/ExperienceTheme";
import { PageStatus } from "@/components/PageStatus";
import { ProductCatalog } from "@/components/ProductCatalog";
import { useI18n } from "@/i18n";
import { api, type VisualSettings, type WalletData } from "@/lib/api-client";
import { experienceStyle } from "@/lib/experience-style";
export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "My wallet | Elite Rewards" }] }),
  component: Wallet,
});
function Wallet() {
  const navigate = useNavigate();
  const { t, locale, formatNumber, formatDateTime, errorMessage } = useI18n();
  const [data, setData] = useState<WalletData | null>(null),
    [busy, setBusy] = useState(true),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [historyOpen, setHistoryOpen] = useState(false),
    [codeOpen, setCodeOpen] = useState(false),
    [redeemingId, setRedeemingId] = useState<string | null>(null),
    [referral, setReferral] = useState<{ sharePath: string; referralCount: number } | null>(null),
    [settings, setSettings] = useState<VisualSettings | null>(null);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const session = await api.session();
      if (!session.user || session.user.role !== "member") {
        await navigate({ to: "/login", search: { access: "member" } });
        return;
      }
      const [wallet, visualSettings] = await Promise.all([api.wallet(), api.visualSettings()]);
      setData(wallet);
      setSettings(visualSettings);
    } catch (cause) {
      setError(errorMessage(cause, "Wallet failed to load"));
    } finally {
      setBusy(false);
    }
  }, [navigate, errorMessage]);
  useEffect(() => {
    void load();
  }, [load]);
  const redeem = async (rewardId: string, name: string, cost: number) => {
    if (redeemingId !== null) return;
    if (
      !window.confirm(
        data?.loyaltyMode === "visits"
          ? t(
              "Redeem {rewardName} for {count} visits? This will deduct the visits from your balance.",
              {
                rewardName: name,
                count: cost,
              },
            )
          : t(
              "Redeem {rewardName} for {count} points? This will deduct the points from your balance.",
              { rewardName: name, count: cost },
            ),
      )
    )
      return;
    setError("");
    setRedeemingId(rewardId);
    try {
      const result = await api.redeem(rewardId);
      setNotice(t("{rewardName} redeemed. Code: {code}", { rewardName: name, code: result.code }));
      await load();
    } catch (cause) {
      setError(errorMessage(cause, "Redemption failed"));
    } finally {
      setRedeemingId(null);
    }
  };
  const logout = async () => {
    await api.logout();
    await navigate({ to: "/login", search: { access: "member" } });
  };
  const loadReferral = async () => {
    try {
      setReferral(await api.referral());
    } catch (cause) {
      setError(errorMessage(cause, "Referral link unavailable"));
    }
  };
  if (busy) return <PageStatus title={t("Loading secure wallet…")} loading />;
  if (!data)
    return (
      <PageStatus
        title={t("Wallet unavailable.")}
        message={error}
        retryLabel={t("Try again")}
        onRetry={() => void load()}
        action={
          <a className="button button-ghost" href="/login?access=member">
            {t("Go to sign in")}
          </a>
        }
      />
    );
  const unitLabel = data.loyaltyMode === "visits" ? t("visits") : t("points");
  const shortUnitLabel = data.loyaltyMode === "visits" ? t("visits") : t("pts");
  const futureRewardPoints = data.rewards
    .map((reward) => reward.cost)
    .filter((cost) => cost > data.balance);
  const readyReward = data.rewards.some((reward) => reward.cost <= data.balance),
    next = futureRewardPoints.length ? Math.min(...futureRewardPoints) : null;
  const localized = (english: string, spanish: string) =>
    locale === "es" ? spanish || english : english;
  return (
    <div
      className={`wallet-page theme-${settings?.themeKey ?? "elite-signature"}`}
      style={experienceStyle(settings)}
    >
      <ExperienceBackdrop settings={settings} audience="member" />
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      <header className="wallet-header container-mid">
        <BusinessBrand business={data.context} nameColor={settings?.businessNameColor} />
        <button className="back-link plain-button" onClick={logout}>
          <LogOut size={17} /> {t("Sign out")}
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
            {settings && localized(settings.companySlogan, settings.companySloganEs) && (
              <span className="member-company-slogan">
                {localized(settings.companySlogan, settings.companySloganEs)}
              </span>
            )}
            <h1>
              {(settings && localized(settings.memberHeadline, settings.memberHeadlineEs)) || (
                <>
                  {t("Welcome back,")} <em>{data.member.name.split(" ")[0]}.</em>
                </>
              )}
            </h1>
            <p>
              {(settings && localized(settings.memberMessage, settings.memberMessageEs)) ||
                t("Your balance is authoritative and updates from the live rewards ledger.")}
            </p>
          </div>
          <div className="points-orb">
            <small>{t("Available balance")}</small>
            <strong>{formatNumber(data.balance)}</strong>
            <span>{unitLabel}</span>
          </div>
        </section>
        {settings?.showRewards !== false && (
          <>
            <section className="next-reward-card">
              <div>
                <span className="reward-glyph">
                  <Gift />
                </span>
                <div>
                  <small>{t(data.rewards.length ? "Next milestone" : "Reward catalog")}</small>
                  <h2>
                    {!data.rewards.length
                      ? t("New rewards are coming soon.")
                      : readyReward
                        ? t("A reward is ready.")
                        : data.loyaltyMode === "visits"
                          ? t("{count} visits until your next reward", {
                              count: (next ?? data.balance) - data.balance,
                            })
                          : t("{count} points until your next reward", {
                              count: (next ?? data.balance) - data.balance,
                            })}
                  </h2>
                </div>
              </div>
              {data.rewards.length > 0 && (
                <>
                  <div className="reward-progress">
                    <span
                      style={{
                        width: `${readyReward ? 100 : Math.min(100, (data.balance / (next ?? 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="reward-scale">
                    <span>0</span>
                    <span>
                      {readyReward ? t("Reward ready") : `${formatNumber(next ?? 0)} ${unitLabel}`}
                    </span>
                  </div>
                </>
              )}
            </section>
            <div className="wallet-section-title">
              <div>
                <span className="section-kicker">{t("Choose your perk")}</span>
                <h2>{t("Rewards for you")}</h2>
              </div>
              <button className="text-button" onClick={() => setHistoryOpen(true)}>
                <History size={17} /> {t("Reward history")}
              </button>
            </div>
            <section className="reward-grid">
              {data.rewards.map((reward, index) => {
                const disabled = data.balance < reward.cost;
                return (
                  <article
                    className={`reward-card ${["champagne", "gold", "amber"][index % 3]}`}
                    key={reward.id}
                  >
                    <span className="reward-card-icon">
                      <Gift />
                    </span>
                    <span className="reward-cost">
                      {formatNumber(reward.cost)} {shortUnitLabel}
                    </span>
                    <h3>{reward.name}</h3>
                    <p>{reward.description}</p>
                    <button
                      disabled={disabled || redeemingId !== null}
                      onClick={() => void redeem(reward.id, reward.name, reward.cost)}
                    >
                      {t(
                        redeemingId === reward.id
                          ? "Redeeming…"
                          : disabled
                            ? "Keep earning"
                            : "Redeem",
                      )}
                      <ChevronRight size={17} />
                    </button>
                  </article>
                );
              })}
              {!data.rewards.length && (
                <p className="empty-table">
                  {t("This business has not published an available reward yet. Check back soon.")}
                </p>
              )}
            </section>
          </>
        )}
        {settings?.showProducts !== false && (
          <>
            <div className="wallet-section-title">
              <div>
                <span className="section-kicker">{t("Member products")}</span>
                <h2>
                  {t("Products from {businessName}", { businessName: data.context.business_name })}
                </h2>
              </div>
            </div>
            <ProductCatalog
              products={data.products}
              loyaltyMode={data.loyaltyMode}
              className="member-product-grid"
              emptyMessage={t("This business has not published products yet.")}
            />
          </>
        )}
        <section className="scan-panel">
          <div>
            <span className="scan-icon">
              <QrCode />
            </span>
            <div>
              <h3>{t("Earn on your next visit")}</h3>
              <p>{t("Show your unique member code at checkout.")}</p>
            </div>
          </div>
          <button onClick={() => setCodeOpen(true)}>{t("Show member code")}</button>
        </section>
        {settings?.showReferrals !== false && (
          <section className="referral-panel panel">
            <div>
              <span className="scan-icon">
                <Share2 />
              </span>
              <div>
                <span className="section-kicker">{t("Invite friends & family")}</span>
                <h3>{t("Share your rewards link")}</h3>
                <p>
                  {t("Friends can use your secure link to create a wallet for {businessName}.", {
                    businessName: data.context?.business_name ?? "Elite Rewards",
                  })}
                </p>
              </div>
            </div>
            {referral ? (
              <div className="referral-share">
                <code>{`${window.location.origin}${referral.sharePath}`}</code>
                <button
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(`${window.location.origin}${referral.sharePath}`)
                      .then(() => setNotice(t("Referral link copied.")))
                      .catch(() => setError(t("Copy failed. Select and copy the link manually.")))
                  }
                >
                  <Copy size={17} /> {t("Copy link")}
                </button>
                <small>{t("{count} joined referral", { count: referral.referralCount })}</small>
              </div>
            ) : (
              <button onClick={() => void loadReferral()}>{t("Create my referral link")}</button>
            )}
          </section>
        )}
        {data.redemptions.length > 0 && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <span>
                  <Gift />
                </span>
                <h3>{t("Active reward codes")}</h3>
              </div>
            </div>
            <ul className="history-list">
              {data.redemptions
                .filter((x) => x.status === "active")
                .map((x) => (
                  <li key={x.id}>
                    <span>
                      <strong>{x.name}</strong>
                      <small>{formatDateTime(x.created_at)}</small>
                    </span>
                    <b>{x.code}</b>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </main>
      {historyOpen && (
        <Modal title={t("Reward history")} close={() => setHistoryOpen(false)}>
          <ul className="history-list">
            {data.ledger.length ? (
              data.ledger.map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>{item.reward_name ?? item.note}</strong>
                    <small>{formatDateTime(item.created_at)}</small>
                  </span>
                  <b>
                    {item.unitsDelta > 0 ? "+" : ""}
                    {formatNumber(item.unitsDelta)}{" "}
                    {data.loyaltyMode === "visits" ? t("visits") : t("pts")}
                  </b>
                </li>
              ))
            ) : (
              <li>{t("No activity yet.")}</li>
            )}
          </ul>
        </Modal>
      )}
      {codeOpen && (
        <Modal title={t("Member code")} close={() => setCodeOpen(false)}>
          <div className="member-code">{data.member.memberCode}</div>
          <p>
            {t("Only show this code to authorized staff at {locationName}.", {
              locationName: data.context?.location_name ?? "",
            })}
          </p>
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
  const { t } = useI18n();
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="award-modal history-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={close} aria-label={t("Close")}>
          <X />
        </button>
        <span className="modal-icon">
          <History />
        </span>
        <span className="section-kicker">{t("Live account")}</span>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
