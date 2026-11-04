import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Award,
  Check,
  CircleDollarSign,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api, type DashboardData, type SessionUser } from "@/lib/api-client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Business dashboard | Elite Rewards" }] }),
  component: Admin,
});
const sections = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Members", icon: Users },
  { label: "Transactions", icon: ReceiptText },
  { label: "Rewards", icon: Trophy },
];

function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [active, setActive] = useState("Dashboard");
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [award, setAward] = useState({
    memberId: "",
    amount: "",
    points: "",
    note: "Eligible purchase",
  });
  const load = useCallback(async () => {
    try {
      const session = await api.session();
      if (!session.user || session.user.role === "member") {
        await navigate({ to: "/login" });
        return;
      }
      setUser(session.user);
      const dashboard = await api.dashboard();
      setData(dashboard);
      const firstMember = dashboard.members[0];
      if (!award.memberId && firstMember)
        setAward((current) => ({ ...current, memberId: firstMember.id }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dashboard failed to load");
    } finally {
      setBusy(false);
    }
  }, [award.memberId, navigate]);
  useEffect(() => {
    void load();
  }, [load]);
  const submitAward = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await api.award({
        memberId: award.memberId,
        amountCents: Math.round(Number(award.amount) * 100),
        points: Number(award.points),
        note: award.note,
      });
      setModal(false);
      setNotice("Points were added to the production ledger.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Award failed");
    }
  };
  const logout = async () => {
    await api.logout();
    await navigate({ to: "/login" });
  };
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.transactions ?? []).filter(
      (item) =>
        !term ||
        [item.member, item.rewardName, item.type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [data, search]);
  if (busy) return <Loading label="Loading secure dashboard…" />;
  if (!data || !user) return <Loading label={error || "Dashboard is unavailable."} />;
  return (
    <div className="admin-shell">
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      <aside className={`admin-sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-top">
          <BrandMark compact />
          <button onClick={() => setMobile(false)} className="mobile-close" aria-label="Close menu">
            <X />
          </button>
        </div>
        <div className="store-chip">
          <span>
            <Store />
          </span>
          <div>
            <small>Current location</small>
            <strong>{data.business.location_name}</strong>
          </div>
        </div>
        <nav>
          {sections.map(({ label, icon: Icon }) => (
            <button
              className={active === label ? "active" : ""}
              key={label}
              onClick={() => {
                setActive(label);
                setMobile(false);
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={logout}>
            <LogOut /> Sign out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <button className="menu-trigger" onClick={() => setMobile(true)} aria-label="Open menu">
            <Menu />
          </button>
          <div>
            <span className="admin-eyebrow">{data.business.business_name}</span>
            <h1>{active}</h1>
          </div>
          <div className="admin-header-actions">
            <label className="search-box">
              <Search />
              <input
                aria-label="Search transactions"
                placeholder="Search activity…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="owner-chip">
              <span>{initials(user.name)}</span>
              <div>
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </div>
            </div>
          </div>
        </header>
        <main className="dashboard-content">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {active === "Dashboard" && (
            <>
              <section className="dashboard-welcome">
                <div>
                  <span className="demo-badge">Live production ledger</span>
                  <h2>Rewards activity you can trust.</h2>
                  <p>
                    Balances and transactions are stored server-side for{" "}
                    {data.business.business_name}.
                  </p>
                </div>
                <button
                  className="admin-primary"
                  onClick={() => setModal(true)}
                  disabled={!data.members.length}
                  title={!data.members.length ? "Add a member before awarding points" : undefined}
                >
                  <Plus /> {data.members.length ? "Award points" : "No members yet"}
                </button>
              </section>
              <section className="metrics-grid">
                <Metric
                  icon={Users}
                  label="Total members"
                  value={data.metrics.members.toLocaleString()}
                />
                <Metric
                  icon={Award}
                  label="Points awarded"
                  value={data.metrics.pointsAwarded.toLocaleString()}
                />
                <Metric
                  icon={Gift}
                  label="Rewards redeemed"
                  value={data.metrics.rewardsRedeemed.toLocaleString()}
                />
                <Metric
                  icon={CircleDollarSign}
                  label="Eligible sales"
                  value={`$${(data.metrics.eligibleSalesCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
              </section>
              <TransactionTable transactions={visible} />
              <section className="panel health-panel">
                <div>
                  <span className="health-icon">
                    <ShieldCheck />
                  </span>
                  <p>
                    <strong>Production ledger active</strong>
                    <small>
                      Authentication, authorization, PostgreSQL persistence, and idempotent
                      mutations are connected.
                    </small>
                  </p>
                </div>
                <span className="uptime">Database connected</span>
              </section>
            </>
          )}
          {active === "Members" && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <span>
                    <Users />
                  </span>
                  <h3>Members</h3>
                </div>
              </div>
              <div className="member-list">
                {data.members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setAward({ ...award, memberId: member.id });
                      setModal(true);
                    }}
                  >
                    <span className="member-avatar">{initials(member.name)}</span>
                    <span>
                      <strong>{member.name}</strong>
                      <small>
                        {member.email} · {member.points.toLocaleString()} points
                      </small>
                    </span>
                    <Award />
                  </button>
                ))}
                {!data.members.length && (
                  <p className="empty-table">
                    No members have been added yet. Member enrollment is the next account setup
                    step.
                  </p>
                )}
              </div>
            </section>
          )}
          {active === "Transactions" && <TransactionTable transactions={visible} />}
          {active === "Rewards" && (
            <section className="reward-grid">
              {data.rewards.map((reward, index) => (
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
                  <button disabled>Active reward</button>
                </article>
              ))}
            </section>
          )}
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(false)}>
          <form
            className="award-modal"
            role="dialog"
            aria-modal="true"
            onSubmit={submitAward}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setModal(false)}
              aria-label="Close"
            >
              <X />
            </button>
            <span className="modal-icon">
              <Award />
            </span>
            <span className="section-kicker">Production award</span>
            <h2>Reward a member</h2>
            <p>This writes an immutable entry to the rewards ledger.</p>
            <label>
              Member
              <select
                required
                value={award.memberId}
                onChange={(e) => setAward({ ...award, memberId: e.target.value })}
              >
                {data.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {member.points} points
                  </option>
                ))}
              </select>
            </label>
            <label>
              Purchase amount
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={award.amount}
                onChange={(e) => setAward({ ...award, amount: e.target.value })}
              />
            </label>
            <label>
              Points
              <input
                type="number"
                min="1"
                step="1"
                required
                value={award.points}
                onChange={(e) => setAward({ ...award, points: e.target.value })}
              />
            </label>
            <label>
              Reason
              <input
                maxLength={300}
                value={award.note}
                onChange={(e) => setAward({ ...award, note: e.target.value })}
              />
            </label>
            <button className="admin-primary full">Post award</button>
          </form>
        </div>
      )}
    </div>
  );
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function Loading({ label }: { label: string }) {
  return (
    <div className="error-screen">
      <div>
        <BrandMark />
        <h1>{label}</h1>
        <p>
          <a className="button button-dark" href="/login">
            Go to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <article className="metric-card">
      <span className="metric-icon">
        <Icon />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>
          <span>Live</span> production data
        </p>
      </div>
    </article>
  );
}
function TransactionTable({ transactions }: { transactions: DashboardData["transactions"] }) {
  return (
    <section className="panel transaction-panel">
      <div className="panel-title">
        <div>
          <span>
            <ReceiptText />
          </span>
          <h3>Transactions</h3>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Purchase</th>
              <th>Points</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>
                  <span className="member-avatar">{initials(t.member)}</span>
                  <span>
                    <strong>{t.member}</strong>
                    <small>{t.rewardName ?? new Date(t.time).toLocaleString()}</small>
                  </span>
                </td>
                <td>{t.amount ? `$${t.amount.toFixed(2)}` : "Reward"}</td>
                <td className={t.type === "earned" ? "positive" : "redeemed"}>
                  {t.type === "earned" ? "+" : "−"}
                  {t.points}
                </td>
                <td>
                  <span className={`table-status ${t.type}`}>
                    {t.type === "earned" ? "Awarded" : "Redeemed"}
                  </span>
                </td>
              </tr>
            ))}
            {!transactions.length && (
              <tr>
                <td colSpan={4} className="empty-table">
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
