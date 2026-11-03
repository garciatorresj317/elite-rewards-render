import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  CalendarHeart,
  Check,
  ChevronDown,
  CircleDollarSign,
  Gift,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrandMark } from "@/components/BrandMark";
import { activityData, growthData, seedTransactions, type Transaction } from "@/data/rewards";
import { addDemoPoints, readTransactions, saveTransactions } from "@/lib/demo-storage";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Business dashboard | Elite Rewards" },
      { name: "description", content: "Manage members, rewards, activity, and performance." },
    ],
  }),
  component: Admin,
});
const nav = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Members", icon: Users },
  { label: "Transactions", icon: ReceiptText },
  { label: "Rewards & rules", icon: Trophy },
  { label: "Birthday rewards", icon: CalendarHeart },
  { label: "Reports", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];
function Admin() {
  const [active, setActive] = useState("Dashboard"),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState(false),
    [toast, setToast] = useState(""),
    [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };
  useEffect(() => {
    setTransactions(readTransactions(seedTransactions));
  }, []);
  const award = () => {
    const next: Transaction = {
      id: crypto.randomUUID(),
      member: "Maya Thompson",
      initials: "MT",
      amount: 32,
      points: 160,
      type: "earned",
      time: "Just now",
    };
    const all = [next, ...transactions];
    setTransactions(all);
    const transactionSaved = saveTransactions(all);
    const walletSaved = addDemoPoints(next.points);
    setModal(false);
    showToast(
      transactionSaved && walletSaved
        ? "160 points awarded to Maya Thompson and synced to her demo wallet."
        : "160 points awarded for this session, but this browser blocked persistent storage.",
    );
  };
  const changeSection = (label: string) => {
    setActive(label);
    setMobile(false);
    if (label !== "Dashboard") {
      showToast(`${label} is not implemented yet. It remains on the completion backlog.`);
    }
  };
  return (
    <div className="admin-shell">
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <Check size={18} />
          {toast}
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
            <strong>North & Pine</strong>
          </div>
          <ChevronDown size={16} />
        </div>
        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button
              className={active === label ? "active" : ""}
              key={label}
              onClick={() => changeSection(label)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={() => showToast("Help and training are not connected yet.")}>
            <HelpCircle /> Help center
          </button>
          <Link to="/">
            <LogOut /> Exit demo
          </Link>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <button className="menu-trigger" onClick={() => setMobile(true)} aria-label="Open menu">
            <Menu />
          </button>
          <div>
            <span className="admin-eyebrow">Business overview</span>
            <h1>{active}</h1>
          </div>
          <div className="admin-header-actions">
            <label className="search-box">
              <Search />
              <input aria-label="Search" placeholder="Search members..." />
            </label>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => showToast("You have 3 demonstration member updates.")}
            >
              <Bell />
              <span />
            </button>
            <div className="owner-chip">
              <span>AM</span>
              <div>
                <strong>Alex Morgan</strong>
                <small>Owner</small>
              </div>
              <ChevronDown />
            </div>
          </div>
        </header>
        <main className="dashboard-content">
          <section className="dashboard-welcome">
            <div>
              <span className="demo-badge">Interactive demonstration</span>
              <h2>Here’s how loyalty is growing.</h2>
              <p>Sample members, rewards, and revenue for North & Pine.</p>
            </div>
            <button className="admin-primary" onClick={() => setModal(true)}>
              <Plus /> Award points
            </button>
          </section>
          <section className="metrics-grid">
            <Metric
              icon={Users}
              label="Total members"
              value="4,892"
              trend="6.3%"
              note="last 30 days"
            />
            <Metric icon={Sparkles} label="Points awarded" value="1,248,750" trend="8.7%" />
            <Metric icon={Gift} label="Rewards redeemed" value="3,421" trend="5.9%" />
            <Metric icon={CircleDollarSign} label="Eligible sales" value="$286,439" trend="7.1%" />
          </section>
          <section className="chart-grid">
            <article className="panel growth-panel">
              <PanelTitle icon={TrendingUp} title="Member growth" action="Last 6 months" />
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={growthData}
                    margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffd84d" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#9b6200" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3c3118" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#d4c89e", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[3000, 5000]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#d4c89e", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        color: "#fff7d5",
                        background: "#090806",
                        border: "1px solid #d99b17",
                        boxShadow: "0 12px 30px rgba(255,187,28,.16)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="members"
                      stroke="#ffd84d"
                      strokeWidth={3}
                      fill="url(#growthFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="panel activity-panel">
              <PanelTitle icon={Gift} title="Reward activity" action="30 days" />
              <div className="activity-body">
                <div className="donut">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activityData}
                        dataKey="value"
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {activityData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <span>
                    <strong>3,421</strong>
                    <small>redemptions</small>
                  </span>
                </div>
                <div className="activity-legend">
                  {activityData.map((x) => (
                    <div key={x.name}>
                      <span style={{ background: x.fill }} />
                      <p>{x.name}</p>
                      <strong>{x.value}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </section>
          <section className="lower-grid">
            <article className="panel transaction-panel">
              <PanelTitle icon={ReceiptText} title="Recent transactions" action="View all" />
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
                    {transactions.slice(0, 5).map((t) => (
                      <tr key={t.id}>
                        <td>
                          <span className="member-avatar">{t.initials}</span>
                          <span>
                            <strong>{t.member}</strong>
                            <small>{t.time}</small>
                          </span>
                        </td>
                        <td>${t.amount.toFixed(2)}</td>
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
                  </tbody>
                </table>
              </div>
            </article>
            <div className="right-stack">
              <article className="panel quick-panel">
                <PanelTitle icon={Activity} title="Quick actions" />
                <div className="quick-grid">
                  <button onClick={() => setModal(true)}>
                    <Award />
                    Award points
                  </button>
                  <button onClick={() => changeSection("Members")}>
                    <Users />
                    View members
                  </button>
                  <button onClick={() => changeSection("Rewards & rules")}>
                    <Trophy />
                    Manage rewards
                  </button>
                  <button onClick={() => changeSection("Reports")}>
                    <BarChart3 />
                    View reports
                  </button>
                </div>
              </article>
              <article className="panel health-panel">
                <PanelTitle icon={ShieldCheck} title="Build status" />
                <div>
                  <span className="health-icon">
                    <Check />
                  </span>
                  <p>
                    <strong>Front-end demonstration ready</strong>
                    <small>
                      Authentication, database, integrations, and monitoring are not connected.
                    </small>
                  </p>
                </div>
                <span className="uptime">Production services pending</span>
              </article>
            </div>
          </section>
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(false)}>
          <div
            className="award-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="award-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setModal(false)}
              aria-label="Close dialog"
            >
              <X />
            </button>
            <span className="modal-icon">
              <Award />
            </span>
            <span className="section-kicker">Quick award</span>
            <h2 id="award-modal-title">Reward a member</h2>
            <p>
              Add points after an eligible purchase. This demo saves the transaction in your
              browser.
            </p>
            <label>
              Member
              <input value="Maya Thompson" readOnly />
            </label>
            <label>
              Purchase amount
              <input value="$32.00" readOnly />
            </label>
            <div className="award-equation">
              <span>$32.00 purchase</span>
              <strong>× 5 points</strong>
              <span>= 160 points</span>
            </div>
            <button className="admin-primary full" onClick={award}>
              Award 160 points
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  trend,
  note,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  trend: string;
  note?: string;
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
          <span>
            <TrendingUp />+{trend}
          </span>{" "}
          {note}
        </p>
      </div>
    </article>
  );
}
function PanelTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Users;
  title: string;
  action?: string;
}) {
  return (
    <div className="panel-title">
      <div>
        <span>
          <Icon />
        </span>
        <h3>{title}</h3>
      </div>
      {action && (
        <button>
          {action}
          <ChevronDown />
        </button>
      )}
    </div>
  );
}
