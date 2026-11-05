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
  Pencil,
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
import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BusinessBrand } from "@/components/BusinessBrand";
import { ExperienceBackdrop } from "@/components/ExperienceTheme";
import { themeCatalog } from "@/lib/theme-catalog";
import {
  api,
  type ClientBrandingDraft,
  type ClientSummary,
  type DashboardData,
  type ManagedReward,
  type MemberSummary,
  type RewardDraft,
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
  const [clientEditor, setClientEditor] = useState<ClientSummary | null>(null);
  const [clientRewards, setClientRewards] = useState<ManagedReward[]>([]);
  const [clientRewardEditingId, setClientRewardEditingId] = useState<string | null>(null);
  const [clientRewardDraft, setClientRewardDraft] = useState<RewardDraft>({
    name: "",
    description: "",
    points: 100,
    active: true,
    inventoryRemaining: null,
  });
  const [clientBranding, setClientBranding] = useState<ClientBrandingDraft>({
    name: "",
    locationName: "",
    logoUrl: null,
    primaryColor: "#F6B900",
    secondaryColor: "#FFE27A",
  });
  const [activationPath, setActivationPath] = useState("");
  const [memberModal, setMemberModal] = useState(false);
  const [memberActivationPath, setMemberActivationPath] = useState("");
  const [managedRewards, setManagedRewards] = useState<ManagedReward[]>([]);
  const [rewardModal, setRewardModal] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
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
  const [rewardForm, setRewardForm] = useState<RewardDraft>({
    name: "",
    description: "",
    points: 100,
    active: true,
    inventoryRemaining: null,
  });
  const load = useCallback(async () => {
    try {
      const session = await api.session();
      if (!session.user || session.user.role === "member") {
        await navigate({ to: "/login" });
        return;
      }
      setUser(session.user);
      const [dashboard, clientResult, memberResult, visualResult, rewardResult] = await Promise.all(
        [
          api.dashboard(),
          session.user.platformAdmin ? api.clients() : Promise.resolve({ clients: [] }),
          api.members(),
          api.visualSettings(),
          session.user.role === "owner"
            ? api.managedRewards()
            : Promise.resolve({ rewards: [] as ManagedReward[] }),
        ],
      );
      setData(dashboard);
      setClients(clientResult.clients);
      setMembers(memberResult.members);
      setVisualSettings(visualResult);
      setManagedRewards(rewardResult.rewards);
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
  const openClientEditor = async (client: ClientSummary) => {
    setError("");
    try {
      const [result, rewards] = await Promise.all([
        api.clientBranding(client.id),
        api.clientRewards(client.id),
      ]);
      setClientEditor(client);
      setClientRewards(rewards.rewards);
      setClientBranding({
        name: result.branding.name,
        locationName: result.branding.locationName,
        logoUrl: result.branding.logoUrl,
        primaryColor: result.branding.primaryColor,
        secondaryColor: result.branding.secondaryColor,
      });
      setClientRewardEditingId(null);
      setClientRewardDraft({
        name: "",
        description: "",
        points: 100,
        active: true,
        inventoryRemaining: null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client customization failed to load");
    }
  };
  const saveClientBranding = async () => {
    if (!clientEditor) return;
    setError("");
    try {
      const result = await api.updateClientBranding(clientEditor.id, clientBranding);
      setClients((current) =>
        current.map((client) =>
          client.id === clientEditor.id
            ? {
                ...client,
                name: result.branding.name,
                locationName: result.branding.locationName,
                logoUrl: result.branding.logoUrl,
                primaryColor: result.branding.primaryColor,
                secondaryColor: result.branding.secondaryColor,
              }
            : client,
        ),
      );
      setNotice(`${result.branding.name} branding was published.`);
      setClientEditor(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client customization failed");
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
  const emptyRewardForm = (): RewardDraft => ({
    name: "",
    description: "",
    points: 100,
    active: true,
    inventoryRemaining: null,
  });
  const saveClientReward = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientEditor) return;
    setError("");
    try {
      const wasEditing = Boolean(clientRewardEditingId);
      if (clientRewardEditingId)
        await api.updateClientReward(clientEditor.id, clientRewardEditingId, clientRewardDraft);
      else await api.createClientReward(clientEditor.id, clientRewardDraft);
      setClientRewards((await api.clientRewards(clientEditor.id)).rewards);
      setClientRewardEditingId(null);
      setClientRewardDraft(emptyRewardForm());
      setNotice(wasEditing ? "Client reward updated." : "Client reward created.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client reward update failed");
    }
  };
  const editClientReward = (reward: ManagedReward) => {
    setClientRewardEditingId(reward.id);
    setClientRewardDraft({
      name: reward.name,
      description: reward.description,
      points: reward.points,
      active: reward.active,
      inventoryRemaining: reward.inventoryRemaining,
    });
  };
  const archiveSelectedClientReward = async () => {
    if (!clientEditor || !clientRewardEditingId) return;
    await api.archiveClientReward(clientEditor.id, clientRewardEditingId);
    setClientRewards((await api.clientRewards(clientEditor.id)).rewards);
    setClientRewardEditingId(null);
    setClientRewardDraft(emptyRewardForm());
    setNotice("Client reward archived.");
  };
  const openNewReward = () => {
    setEditingRewardId(null);
    setRewardForm(emptyRewardForm());
    setRewardModal(true);
  };
  const openReward = (reward: ManagedReward) => {
    setEditingRewardId(reward.id);
    setRewardForm({
      name: reward.name,
      description: reward.description,
      points: reward.points,
      active: reward.active,
      inventoryRemaining: reward.inventoryRemaining,
    });
    setRewardModal(true);
  };
  const submitReward = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (editingRewardId) await api.updateReward(editingRewardId, rewardForm);
      else await api.createReward(rewardForm);
      setRewardModal(false);
      setNotice(editingRewardId ? "Reward offer updated." : "Reward offer created.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reward update failed");
    }
  };
  const archiveCurrentReward = async () => {
    if (!editingRewardId || !window.confirm("Archive this reward? Members will no longer see it."))
      return;
    setError("");
    try {
      await api.archiveReward(editingRewardId);
      setRewardModal(false);
      setNotice("Reward offer archived.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reward archive failed");
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
          {user.platformAdmin ? (
            <BrandMark compact />
          ) : (
            <BusinessBrand business={data.business} compact />
          )}
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
                      {client.logoUrl ? (
                        <img className="client-logo" src={client.logoUrl} alt="" />
                      ) : (
                        <span
                          className="client-avatar"
                          style={{
                            background: `linear-gradient(135deg, ${client.secondaryColor}, ${client.primaryColor})`,
                          }}
                        >
                          {initials(client.name)}
                        </span>
                      )}
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
                    <button
                      className="client-customize"
                      onClick={() => void openClientEditor(client)}
                    >
                      <Palette size={16} /> Customize client
                    </button>
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
            <section className="reward-management">
              <div className="panel reward-management-heading">
                <div>
                  <span className="modal-icon">
                    <Trophy />
                  </span>
                  <div>
                    <span className="section-kicker">Business reward catalog</span>
                    <h2>Choose exactly what members can earn.</h2>
                    <p>
                      Set the offer, points cost, availability, and optional quantity. Wallets
                      update from the live catalog automatically.
                    </p>
                  </div>
                </div>
                <button
                  className="admin-primary"
                  onClick={openNewReward}
                  disabled={user.role !== "owner"}
                >
                  <Plus /> {user.role === "owner" ? "Create reward" : "Owner access required"}
                </button>
              </div>
              <div className="reward-grid">
                {managedRewards.map((reward, index) => (
                  <article
                    className={`reward-card ${["champagne", "gold", "amber"][index % 3]} ${reward.archivedAt ? "archived" : ""}`}
                    key={reward.id}
                  >
                    <span className="reward-card-icon">
                      <Gift />
                    </span>
                    <span className="reward-cost">{reward.points.toLocaleString()} pts</span>
                    <h3>{reward.name}</h3>
                    <p>{reward.description || "No description added."}</p>
                    <div className="reward-meta">
                      <span className={`client-status ${reward.active ? "active" : "invited"}`}>
                        {reward.archivedAt ? "archived" : reward.active ? "active" : "hidden"}
                      </span>
                      <small>
                        {reward.inventoryRemaining === null
                          ? "Unlimited"
                          : `${reward.inventoryRemaining} remaining`}{" "}
                        · {reward.redemptionCount} redeemed
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={() => openReward(reward)}
                      disabled={Boolean(reward.archivedAt)}
                    >
                      <span>{reward.archivedAt ? "Archived" : "Edit reward"}</span>
                      <Pencil size={17} />
                    </button>
                  </article>
                ))}
                {!managedRewards.length && (
                  <p className="empty-table">No rewards yet. Create the first offer for members.</p>
                )}
              </div>
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
      {clientEditor && (
        <div className="modal-backdrop" onMouseDown={() => setClientEditor(null)}>
          <div
            className="award-modal client-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customize-client-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setClientEditor(null)}
              aria-label="Close"
            >
              <X />
            </button>
            <span className="modal-icon">
              <Palette />
            </span>
            <span className="section-kicker">Elite platform control</span>
            <h2 id="customize-client-title">Customize {clientEditor.name}</h2>
            <p>
              Publish the identity used by this client’s business dashboard and member wallets.
              Rewards remain managed in that client’s isolated catalog.
            </p>
            <div className="client-brand-preview" style={clientBrandStyle(clientBranding)}>
              {clientBranding.logoUrl ? (
                <img src={clientBranding.logoUrl} alt="" />
              ) : (
                <span>{initials(clientBranding.name || clientEditor.name)}</span>
              )}
              <strong>{clientBranding.name || clientEditor.name}</strong>
              <small>{clientBranding.locationName || clientEditor.locationName}</small>
            </div>
            <label>
              Business name
              <input
                required
                minLength={2}
                maxLength={120}
                value={clientBranding.name}
                onChange={(event) =>
                  setClientBranding({ ...clientBranding, name: event.target.value })
                }
              />
            </label>
            <label>
              Primary location
              <input
                required
                minLength={2}
                maxLength={120}
                value={clientBranding.locationName}
                onChange={(event) =>
                  setClientBranding({ ...clientBranding, locationName: event.target.value })
                }
              />
            </label>
            <label>
              Company logo URL
              <input
                type="url"
                inputMode="url"
                placeholder="https://example.com/logo.png"
                value={clientBranding.logoUrl ?? ""}
                onChange={(event) =>
                  setClientBranding({ ...clientBranding, logoUrl: event.target.value || null })
                }
              />
            </label>
            <div className="client-color-fields">
              <label>
                Primary color
                <input
                  type="color"
                  value={clientBranding.primaryColor}
                  onChange={(event) =>
                    setClientBranding({ ...clientBranding, primaryColor: event.target.value })
                  }
                />
              </label>
              <label>
                Accent color
                <input
                  type="color"
                  value={clientBranding.secondaryColor}
                  onChange={(event) =>
                    setClientBranding({ ...clientBranding, secondaryColor: event.target.value })
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className="admin-primary full"
              onClick={() => void saveClientBranding()}
            >
              Publish client branding
            </button>
            <div className="client-reward-manager">
              <div>
                <span className="section-kicker">Client rewards</span>
                <h3>Customer-facing offer catalog</h3>
              </div>
              <div className="client-reward-list">
                {clientRewards.map((reward) => (
                  <button
                    type="button"
                    key={reward.id}
                    onClick={() => editClientReward(reward)}
                    disabled={Boolean(reward.archivedAt)}
                  >
                    <span>
                      <strong>{reward.name}</strong>
                      <small>{reward.points.toLocaleString()} points</small>
                    </span>
                    <span className={`client-status ${reward.active ? "active" : "invited"}`}>
                      {reward.archivedAt ? "archived" : reward.active ? "active" : "hidden"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="client-reward-actions">
                <button
                  type="button"
                  className="client-customize"
                  onClick={() => {
                    setClientRewardEditingId(null);
                    setClientRewardDraft(emptyRewardForm());
                  }}
                >
                  <Plus size={16} /> New client reward
                </button>
              </div>
              <form className="client-reward-form" onSubmit={saveClientReward}>
                <label>
                  Reward name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={clientRewardDraft.name}
                    onChange={(event) =>
                      setClientRewardDraft({ ...clientRewardDraft, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Description
                  <textarea
                    maxLength={500}
                    value={clientRewardDraft.description}
                    onChange={(event) =>
                      setClientRewardDraft({
                        ...clientRewardDraft,
                        description: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="client-color-fields">
                  <label>
                    Points
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      value={clientRewardDraft.points}
                      onChange={(event) =>
                        setClientRewardDraft({
                          ...clientRewardDraft,
                          points: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Inventory
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      placeholder="Unlimited"
                      value={clientRewardDraft.inventoryRemaining ?? ""}
                      onChange={(event) =>
                        setClientRewardDraft({
                          ...clientRewardDraft,
                          inventoryRemaining:
                            event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label className="reward-active-check">
                  <input
                    type="checkbox"
                    checked={clientRewardDraft.active}
                    onChange={(event) =>
                      setClientRewardDraft({ ...clientRewardDraft, active: event.target.checked })
                    }
                  />
                  <span>
                    <strong>Visible to this client’s members</strong>
                  </span>
                </label>
                <div className="reward-editor-actions">
                  {clientRewardEditingId && (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void archiveSelectedClientReward()}
                    >
                      Archive
                    </button>
                  )}
                  <button className="admin-primary">
                    {clientRewardEditingId ? "Save client reward" : "Create client reward"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
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
      {rewardModal && (
        <div className="modal-backdrop" onMouseDown={() => setRewardModal(false)}>
          <form
            className="award-modal reward-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reward-editor-title"
            onSubmit={submitReward}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setRewardModal(false)}
              aria-label="Close"
            >
              <X />
            </button>
            <span className="modal-icon">
              <Gift />
            </span>
            <span className="section-kicker">Business reward offer</span>
            <h2 id="reward-editor-title">{editingRewardId ? "Edit reward" : "Create a reward"}</h2>
            <p>Changes publish to this business’s member wallets only.</p>
            <label>
              Reward name
              <input
                required
                minLength={2}
                maxLength={120}
                value={rewardForm.name}
                onChange={(event) => setRewardForm({ ...rewardForm, name: event.target.value })}
                placeholder="Example: Free specialty drink"
              />
            </label>
            <label>
              Description
              <textarea
                maxLength={500}
                value={rewardForm.description}
                onChange={(event) =>
                  setRewardForm({ ...rewardForm, description: event.target.value })
                }
                placeholder="Explain what the member receives and any important eligibility details."
              />
            </label>
            <div className="reward-editor-grid">
              <label>
                Points cost
                <input
                  required
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  value={rewardForm.points}
                  onChange={(event) =>
                    setRewardForm({ ...rewardForm, points: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Quantity available
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  value={rewardForm.inventoryRemaining ?? ""}
                  onChange={(event) =>
                    setRewardForm({
                      ...rewardForm,
                      inventoryRemaining:
                        event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                  placeholder="Unlimited"
                />
              </label>
            </div>
            <label className="reward-active-check">
              <input
                type="checkbox"
                checked={rewardForm.active}
                onChange={(event) => setRewardForm({ ...rewardForm, active: event.target.checked })}
              />
              <span>
                <strong>Visible to members</strong>
                <small>Turn this off to save the offer without publishing it.</small>
              </span>
            </label>
            <div className="reward-editor-actions">
              {editingRewardId && (
                <button type="button" className="danger-button" onClick={archiveCurrentReward}>
                  Archive reward
                </button>
              )}
              <button className="admin-primary">
                {editingRewardId ? "Save changes" : "Create reward"}
              </button>
            </div>
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
function clientBrandStyle(branding: ClientBrandingDraft) {
  return {
    "--client-primary": branding.primaryColor,
    "--client-secondary": branding.secondaryColor,
  } as CSSProperties;
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
