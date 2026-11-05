import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Award,
  Building2,
  CalendarClock,
  Check,
  CircleDollarSign,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  Trophy,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ExperienceBackdrop } from "@/components/ExperienceTheme";
import { themeCatalog } from "@/lib/theme-catalog";
import {
  api,
  type ClientSummary,
  type DashboardData,
  type MemberSummary,
  type SessionUser,
  type ThemeKey,
  type VisualSettings,
} from "@/lib/api-client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Business dashboard | Elite Rewards" }] }),
  component: Admin,
});
const sections = [
  { label: "Dashboard", icon: LayoutDashboard, platformOnly: false },
  { label: "Clients", icon: Building2, platformOnly: true },
  { label: "Members", icon: Users, platformOnly: false },
  { label: "Transactions", icon: ReceiptText, platformOnly: false },
  { label: "Rewards", icon: Trophy, platformOnly: false },
  { label: "Appearance", icon: Palette, platformOnly: false },
];

function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [active, setActive] = useState("Dashboard");
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [activationPath, setActivationPath] = useState("");
  const [memberModal, setMemberModal] = useState(false);
  const [memberActivationPath, setMemberActivationPath] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [visualSettings, setVisualSettings] = useState<VisualSettings | null>(null);
  const [visualDraft, setVisualDraft] = useState({
    themeKey: "elite-signature" as ThemeKey,
    occasionTitle: "",
    occasionMessage: "",
    automaticHolidayThemes: false,
    timeZone: "UTC",
  });
  const [award, setAward] = useState({
    memberId: "",
    amount: "",
    points: "",
    note: "Eligible purchase",
  });
  const [clientForm, setClientForm] = useState({
    businessName: "",
    locationName: "",
    ownerName: "",
    ownerEmail: "",
  });
  const [memberForm, setMemberForm] = useState({ name: "", email: "" });
  const load = useCallback(async () => {
    try {
      const session = await api.session();
      if (!session.user || session.user.role === "member") {
        await navigate({ to: "/login" });
        return;
      }
      setUser(session.user);
      const [dashboard, clientResult, memberResult, visualResult] = await Promise.all([
        api.dashboard(),
        session.user.platformAdmin ? api.clients() : Promise.resolve({ clients: [] }),
        api.members(),
        api.visualSettings(),
      ]);
      setData(dashboard);
      setClients(clientResult.clients);
      setMembers(memberResult.members);
      setVisualSettings(visualResult);
      setVisualDraft({
        themeKey: visualResult.configuredThemeKey,
        occasionTitle: visualResult.configuredOccasionTitle,
        occasionMessage: visualResult.configuredOccasionMessage,
        automaticHolidayThemes: visualResult.automaticHolidayThemes,
        timeZone: visualResult.timeZone,
      });
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
  const submitClient = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const result = await api.createClient(clientForm);
      setClients((current) => [...current, result.client]);
      setActivationPath(result.activationPath);
      setNotice(`${result.client.name} was added.`);
      setClientForm({ businessName: "", locationName: "", ownerName: "", ownerEmail: "" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client creation failed");
    }
  };
  const submitMember = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const result = await api.createMember(memberForm);
      setMembers((current) => [result.member, ...current]);
      setMemberActivationPath(result.activationPath);
      setNotice(`${result.member.name} was enrolled.`);
      setMemberForm({ name: "", email: "" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Member enrollment failed");
    }
  };
  const logout = async () => {
    await api.logout();
    await navigate({ to: "/login" });
  };
  const saveVisuals = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const result = await api.updateVisualSettings(visualDraft);
      setVisualSettings(result);
      setNotice("Business pages and dashboards were updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Appearance update failed");
    }
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
    <div className={`admin-shell theme-${visualSettings?.themeKey ?? "elite-signature"}`}>
      <ExperienceBackdrop settings={visualSettings} audience="admin" />
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
          {sections
            .filter((section) => !section.platformOnly || user.platformAdmin)
            .map(({ label, icon: Icon }) => (
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
          {active === "Clients" && user.platformAdmin && (
            <section className="panel client-panel">
              <div className="panel-title client-panel-title">
                <div>
                  <span>
                    <Building2 />
                  </span>
                  <div>
                    <h3>Business clients</h3>
                    <small>Create and track each rewards program from one place.</small>
                  </div>
                </div>
                <button
                  className="admin-primary"
                  onClick={() => {
                    setClientModal(true);
                    setActivationPath("");
                  }}
                >
                  <Plus /> Add client
                </button>
              </div>
              <div className="client-grid">
                {clients.map((client) => (
                  <article className="client-card" key={client.id}>
                    <div className="client-card-top">
                      <span className="client-avatar">{initials(client.name)}</span>
                      <span className={`client-status ${client.status}`}>{client.status}</span>
                    </div>
                    <h3>{client.name}</h3>
                    <p>{client.locationName}</p>
                    <dl>
                      <div>
                        <dt>Owner</dt>
                        <dd>{client.ownerName}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{client.ownerEmail}</dd>
                      </div>
                      <div>
                        <dt>Members</dt>
                        <dd>{client.members.toLocaleString()}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          )}
          {active === "Members" && (
            <section className="panel">
              <div className="panel-title client-panel-title">
                <div>
                  <span>
                    <Users />
                  </span>
                  <div>
                    <h3>Members</h3>
                    <small>Enroll customers and track wallet activation.</small>
                  </div>
                </div>
                <button
                  className="admin-primary"
                  onClick={() => {
                    setMemberModal(true);
                    setMemberActivationPath("");
                  }}
                >
                  <UserPlus /> Enroll member
                </button>
              </div>
              <div className="member-list">
                {members.map((member) => (
                  <button
                    key={member.id}
                    disabled={member.status !== "active"}
                    onClick={() => {
                      if (member.status === "active") {
                        setAward({ ...award, memberId: member.id });
                        setModal(true);
                      }
                    }}
                  >
                    <span className="member-avatar">{initials(member.name)}</span>
                    <span>
                      <strong>{member.name}</strong>
                      <small>
                        {member.email} · {member.points.toLocaleString()} points
                      </small>
                    </span>
                    <span className={`client-status ${member.status}`}>{member.status}</span>
                  </button>
                ))}
                {!members.length && (
                  <p className="empty-table">
                    No members yet. Use Enroll member to create the first secure wallet invitation.
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
          {active === "Appearance" && (
            <section className="appearance-layout">
              <div className="panel appearance-intro">
                <span className="modal-icon">
                  <Palette />
                </span>
                <div>
                  <span className="section-kicker">Business customization</span>
                  <h2>Live backgrounds & event themes</h2>
                  <p>
                    Select a high-resolution animated visual for this business’s admin dashboard and
                    member wallets. Motion automatically reduces when a visitor requests it.
                  </p>
                </div>
              </div>
              <form className="appearance-form" onSubmit={saveVisuals}>
                <section className="panel automatic-theme-editor">
                  <div className="automatic-theme-heading">
                    <span className="modal-icon">
                      <CalendarClock />
                    </span>
                    <div>
                      <span className="section-kicker">Automatic schedule</span>
                      <h3>Switch themes on holidays</h3>
                      <p>
                        When enabled, Elite Rewards temporarily publishes the matching holiday theme
                        on its scheduled date, then restores your selected theme automatically.
                      </p>
                    </div>
                  </div>
                  <label className="theme-toggle">
                    <input
                      type="checkbox"
                      checked={visualDraft.automaticHolidayThemes}
                      onChange={(event) =>
                        setVisualDraft({
                          ...visualDraft,
                          automaticHolidayThemes: event.target.checked,
                        })
                      }
                      disabled={user.role !== "owner"}
                    />
                    <span aria-hidden="true" />
                    <strong>
                      {visualDraft.automaticHolidayThemes
                        ? "Automatic holiday themes on"
                        : "Automatic holiday themes off"}
                    </strong>
                  </label>
                  <label className="timezone-field">
                    Business time zone
                    <select
                      value={visualDraft.timeZone}
                      onChange={(event) =>
                        setVisualDraft({ ...visualDraft, timeZone: event.target.value })
                      }
                      disabled={user.role !== "owner"}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="America/Anchorage">Alaska Time</option>
                      <option value="Pacific/Honolulu">Hawaii Time</option>
                    </select>
                  </label>
                  <div className="automatic-theme-status" role="status">
                    {!visualSettings?.automaticHolidayThemes ? (
                      <>
                        <strong>Automatic switching is currently off.</strong>
                        <span>
                          Enable the toggle and publish the appearance to start the schedule.
                        </span>
                      </>
                    ) : visualSettings.automaticThemeActive ? (
                      <>
                        <strong>{visualSettings.automaticThemeName} is active today.</strong>
                        <span>Your manual theme remains saved and will return afterward.</span>
                      </>
                    ) : visualSettings.nextAutomaticTheme ? (
                      <>
                        <strong>
                          Next: {visualSettings.nextAutomaticTheme.name} on{" "}
                          {visualSettings.nextAutomaticTheme.localDate}
                        </strong>
                        <span>{visualSettings.nextAutomaticTheme.dateLabel}</span>
                      </>
                    ) : null}
                  </div>
                  <ul className="automatic-theme-schedule" aria-label="Automatic holiday schedule">
                    <li>
                      <strong>MLK Day</strong>
                      <span>Third Monday in January</span>
                    </li>
                    <li>
                      <strong>Spring Celebration</strong>
                      <span>Easter Sunday</span>
                    </li>
                    <li>
                      <strong>September 11 Remembrance</strong>
                      <span>September 11</span>
                    </li>
                    <li>
                      <strong>Winter Holiday</strong>
                      <span>December 24–26</span>
                    </li>
                  </ul>
                </section>
                <div className="theme-grid" role="radiogroup" aria-label="Business page theme">
                  {themeCatalog.map((theme) => (
                    <label
                      className={`theme-card ${visualDraft.themeKey === theme.key ? "selected" : ""}`}
                      key={theme.key}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={theme.key}
                        checked={visualDraft.themeKey === theme.key}
                        onChange={() => setVisualDraft({ ...visualDraft, themeKey: theme.key })}
                      />
                      <img src={theme.image} alt="" />
                      <span>
                        <small>{theme.category}</small>
                        <strong>{theme.name}</strong>
                        <em>{theme.description}</em>
                      </span>
                    </label>
                  ))}
                </div>
                <section className="panel occasion-editor">
                  <div>
                    <span className="section-kicker">Optional live message</span>
                    <h3>Holiday or event announcement</h3>
                    <p>
                      Use this for a respectful observance, store event, or seasonal message. Leave
                      both fields empty for wallpaper only.
                    </p>
                  </div>
                  <label>
                    Headline
                    <input
                      maxLength={80}
                      value={visualDraft.occasionTitle}
                      onChange={(event) =>
                        setVisualDraft({ ...visualDraft, occasionTitle: event.target.value })
                      }
                      placeholder="Example: Honoring Dr. Martin Luther King Jr."
                    />
                  </label>
                  <label>
                    Message
                    <textarea
                      maxLength={220}
                      value={visualDraft.occasionMessage}
                      onChange={(event) =>
                        setVisualDraft({ ...visualDraft, occasionMessage: event.target.value })
                      }
                      placeholder="Add a short message for members and staff."
                    />
                  </label>
                  <button className="admin-primary" disabled={user.role !== "owner"}>
                    {user.role === "owner" ? "Publish appearance" : "Owner access required"}
                  </button>
                </section>
              </form>
            </section>
          )}
        </main>
      </div>
      {clientModal && (
        <div className="modal-backdrop" onMouseDown={() => setClientModal(false)}>
          <form
            className="award-modal client-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-client-title"
            onSubmit={submitClient}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setClientModal(false)}
              aria-label="Close"
            >
              <X />
            </button>
            <span className="modal-icon">
              <Building2 />
            </span>
            <span className="section-kicker">Platform client</span>
            <h2 id="add-client-title">Add a business client</h2>
            <p>Create an isolated rewards program and a secure owner activation invitation.</p>
            {activationPath ? (
              <div className="activation-result" role="status">
                <strong>Client created</strong>
                <p>Copy this private activation link and send it to the client owner:</p>
                <code>{`${window.location.origin}${activationPath}`}</code>
                <button
                  type="button"
                  className="admin-primary full"
                  onClick={() =>
                    void navigator.clipboard.writeText(`${window.location.origin}${activationPath}`)
                  }
                >
                  Copy activation link
                </button>
              </div>
            ) : (
              <>
                <label>
                  Business name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={clientForm.businessName}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, businessName: event.target.value })
                    }
                  />
                </label>
                <label>
                  First location
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={clientForm.locationName}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, locationName: event.target.value })
                    }
                  />
                </label>
                <label>
                  Client owner name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={clientForm.ownerName}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, ownerName: event.target.value })
                    }
                  />
                </label>
                <label>
                  Client owner email
                  <input
                    required
                    type="email"
                    maxLength={254}
                    value={clientForm.ownerEmail}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, ownerEmail: event.target.value })
                    }
                  />
                </label>
                <button className="admin-primary full">Create client</button>
              </>
            )}
          </form>
        </div>
      )}
      {memberModal && (
        <div className="modal-backdrop" onMouseDown={() => setMemberModal(false)}>
          <form
            className="award-modal client-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enroll-member-title"
            onSubmit={submitMember}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setMemberModal(false)}
              aria-label="Close"
            >
              <X />
            </button>
            <span className="modal-icon">
              <UserPlus />
            </span>
            <span className="section-kicker">Member enrollment</span>
            <h2 id="enroll-member-title">Enroll a rewards member</h2>
            <p>Create a secure, single-use wallet activation invitation.</p>
            {memberActivationPath ? (
              <div className="activation-result" role="status">
                <strong>Member enrolled</strong>
                <p>Copy this private activation link and send it to the member:</p>
                <code>{`${window.location.origin}${memberActivationPath}`}</code>
                <button
                  type="button"
                  className="admin-primary full"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      `${window.location.origin}${memberActivationPath}`,
                    )
                  }
                >
                  Copy activation link
                </button>
              </div>
            ) : (
              <>
                <label>
                  Member name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    value={memberForm.name}
                    onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })}
                  />
                </label>
                <label>
                  Member email
                  <input
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={memberForm.email}
                    onChange={(event) =>
                      setMemberForm({ ...memberForm, email: event.target.value })
                    }
                  />
                </label>
                <button className="admin-primary full">Create member invitation</button>
              </>
            )}
          </form>
        </div>
      )}
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
