export type SessionUser = {
  id: string;
  businessId: string;
  locationId: string | null;
  role: "owner" | "staff" | "member";
  name: string;
  email: string;
  memberCode: string | null;
  platformAdmin: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const origin = typeof window === "undefined" ? undefined : window.location.origin;
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(origin && init?.method && init.method !== "GET" ? { origin } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

async function uploadImage<T>(path: string, file: File): Promise<T> {
  const origin = typeof window === "undefined" ? undefined : window.location.origin;
  const response = await fetch(path, {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "content-type": file.type,
      ...(origin ? { origin } : {}),
    },
    body: file,
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

export const api = {
  session: () => request<{ user: SessionUser | null }>("/api/auth/session"),
  login: (email: string, password: string) =>
    request<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: "{}" }),
  setupStatus: () => request<{ setupRequired: boolean }>("/api/setup/status"),
  setup: (payload: Record<string, string>) =>
    request<{ ok: boolean }>("/api/setup", { method: "POST", body: JSON.stringify(payload) }),
  dashboard: () => request<DashboardData>("/api/admin/dashboard"),
  clients: () => request<{ clients: ClientSummary[] }>("/api/admin/clients"),
  createClient: (payload: {
    businessName: string;
    locationName: string;
    ownerName: string;
    ownerEmail: string;
  }) =>
    request<{ client: ClientSummary; activationPath: string }>("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  setClientActive: (businessId: string, active: boolean) =>
    request<{ client: ClientSummary }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/status`,
      { method: "PUT", body: JSON.stringify({ active }) },
    ),
  clientBranding: (businessId: string) =>
    request<{ branding: ClientBranding }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/branding`,
    ),
  updateClientBranding: (businessId: string, payload: ClientBrandingDraft) =>
    request<{ branding: ClientBranding }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/branding`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  clientVisualSettings: (businessId: string) =>
    request<VisualSettings>(`/api/admin/clients/${encodeURIComponent(businessId)}/visual-settings`),
  updateClientVisualSettings: (businessId: string, payload: VisualSettingsUpdate) =>
    request<VisualSettings>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/visual-settings`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  uploadClientLogo: (businessId: string, file: File) =>
    uploadImage<{ branding: ClientBranding }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/logo`,
      file,
    ),
  publicClient: (businessId: string) =>
    request<PublicClientExperience>(`/api/public/clients/${encodeURIComponent(businessId)}`),
  businessEnrollment: (businessId: string) =>
    request<BusinessEnrollment>(`/api/public/clients/${encodeURIComponent(businessId)}/enrollment`),
  joinBusiness: (businessId: string, payload: JoinBusinessPayload) =>
    request<{ ok: boolean }>(`/api/public/clients/${encodeURIComponent(businessId)}/enrollment`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  clientRewards: (businessId: string) =>
    request<{ rewards: ManagedReward[] }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/rewards`,
    ),
  createClientReward: (businessId: string, payload: RewardDraft) =>
    request<{ reward: ManagedReward }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/rewards`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  updateClientReward: (businessId: string, rewardId: string, payload: RewardDraft) =>
    request<{ reward: ManagedReward }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/rewards/${encodeURIComponent(rewardId)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  archiveClientReward: (businessId: string, rewardId: string) =>
    request<{ ok: boolean }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/rewards/${encodeURIComponent(rewardId)}`,
      { method: "DELETE", body: "{}" },
    ),
  clientProducts: (businessId: string) =>
    request<{ products: ManagedProduct[] }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/products`,
    ),
  createClientProduct: (businessId: string, payload: ProductDraft) =>
    request<{ product: ManagedProduct }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/products`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  updateClientProduct: (businessId: string, productId: string, payload: ProductDraft) =>
    request<{ product: ManagedProduct }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  uploadClientProductImage: (businessId: string, productId: string, file: File) =>
    uploadImage<{ product: ManagedProduct }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId)}/image`,
      file,
    ),
  archiveClientProduct: (businessId: string, productId: string) =>
    request<{ ok: boolean }>(
      `/api/admin/clients/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId)}`,
      { method: "DELETE", body: "{}" },
    ),
  award: (payload: { memberId: string; points: number; amountCents: number; note?: string }) =>
    request<{ id: string; duplicate: boolean }>("/api/admin/award", {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(payload),
    }),
  clientInvitation: (token: string) =>
    request<{
      businessName: string;
      locationName: string;
      ownerName: string;
      ownerEmail: string;
      visualSettings: PublicVisualSettings;
    }>(`/api/client-invitations/status?token=${encodeURIComponent(token)}`),
  activateClient: (token: string, password: string) =>
    request<{ ok: boolean }>("/api/client-invitations/activate", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  members: () => request<{ members: MemberSummary[] }>("/api/admin/members"),
  createMember: (payload: { name: string; email: string }) =>
    request<{ member: MemberSummary; activationPath: string }>("/api/admin/members", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  managedRewards: () => request<{ rewards: ManagedReward[] }>("/api/admin/rewards"),
  createReward: (payload: RewardDraft) =>
    request<{ reward: ManagedReward }>("/api/admin/rewards", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateReward: (rewardId: string, payload: RewardDraft) =>
    request<{ reward: ManagedReward }>(`/api/admin/rewards/${encodeURIComponent(rewardId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  archiveReward: (rewardId: string) =>
    request<{ ok: boolean }>(`/api/admin/rewards/${encodeURIComponent(rewardId)}`, {
      method: "DELETE",
      body: "{}",
    }),
  managedProducts: () => request<{ products: ManagedProduct[] }>("/api/admin/products"),
  createProduct: (payload: ProductDraft) =>
    request<{ product: ManagedProduct }>("/api/admin/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProduct: (productId: string, payload: ProductDraft) =>
    request<{ product: ManagedProduct }>(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  uploadProductImage: (productId: string, file: File) =>
    uploadImage<{ product: ManagedProduct }>(
      `/api/admin/products/${encodeURIComponent(productId)}/image`,
      file,
    ),
  archiveProduct: (productId: string) =>
    request<{ ok: boolean }>(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: "DELETE",
      body: "{}",
    }),
  memberInvitation: (token: string) =>
    request<{
      businessName: string;
      locationName: string;
      memberName: string;
      memberEmail: string;
      visualSettings: PublicVisualSettings;
    }>(`/api/member-invitations/status?token=${encodeURIComponent(token)}`),
  activateMember: (token: string, password: string) =>
    request<{ ok: boolean }>("/api/member-invitations/activate", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  referralEnrollment: (referralCode: string) =>
    request<{
      businessName: string;
      locationName: string;
      logoUrl: string | null;
      primaryColor: string;
      secondaryColor: string;
      visualSettings: PublicVisualSettings;
    }>(`/api/referrals/enrollment?ref=${encodeURIComponent(referralCode)}`),
  joinReferral: (payload: {
    referralCode: string;
    name: string;
    email: string;
    password: string;
  }) =>
    request<{ ok: boolean }>("/api/referrals/join", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  visualSettings: () => request<VisualSettings>("/api/visual-settings"),
  updateVisualSettings: (payload: VisualSettingsUpdate) =>
    request<VisualSettings>("/api/admin/visual-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  wallet: () => request<WalletData>("/api/wallet"),
  referral: () => request<{ sharePath: string; referralCount: number }>("/api/wallet/referral"),
  redeem: (rewardId: string) =>
    request<{ id: string; code: string; duplicate: boolean }>("/api/wallet/redeem", {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ rewardId }),
    }),
};

export type BusinessContext = {
  business_name: string;
  location_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
};

export type DashboardData = {
  business: BusinessContext;
  metrics: {
    members: number;
    pointsAwarded: number;
    rewardsRedeemed: number;
    eligibleSalesCents: number;
  };
  transactions: Array<{
    id: string;
    member: string;
    amount: number;
    points: number;
    type: "earned" | "redeemed";
    time: string;
    rewardName: string | null;
  }>;
  members: Array<{ id: string; name: string; email: string; member_code: string; points: number }>;
  rewards: Array<{ id: string; name: string; description: string; points: number }>;
};

export type WalletData = {
  member: SessionUser;
  context: BusinessContext;
  points: number;
  ledger: Array<{
    id: string;
    entry_type: string;
    pointsDelta: number;
    note: string;
    created_at: string;
    reward_name: string | null;
  }>;
  rewards: Array<{ id: string; name: string; description: string; points: number }>;
  redemptions: Array<{
    id: string;
    reward_id: string;
    name: string;
    points_cost: number;
    code: string;
    status: string;
    created_at: string;
  }>;
  products: PublicProduct[];
};

export type ThemeKey =
  | "elite-signature"
  | "mlk-day"
  | "remembrance-911"
  | "winter-holiday"
  | "spring-celebration"
  | "community-event";

export type PublicVisualSettings = {
  themeKey: ThemeKey;
  occasionTitle: string;
  occasionMessage: string;
  automaticThemeActive: boolean;
};

export type VisualSettings = PublicVisualSettings & {
  configuredThemeKey: ThemeKey;
  configuredOccasionTitle: string;
  configuredOccasionMessage: string;
  automaticHolidayThemes: boolean;
  timeZone: string;
  automaticThemeName: string | null;
  nextAutomaticTheme: { name: string; localDate: string; dateLabel: string } | null;
  updatedAt: string | null;
};

export type VisualSettingsUpdate = Pick<
  VisualSettings,
  "themeKey" | "occasionTitle" | "occasionMessage" | "automaticHolidayThemes" | "timeZone"
>;

export type ClientSummary = {
  id: string;
  name: string;
  locationName: string;
  ownerName: string;
  ownerEmail: string;
  status: "active" | "invited" | "suspended";
  members: number;
  createdAt: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  previewPath: string;
  nfcPath: string;
  joinPath: string;
};

export type ClientBranding = {
  id: string;
  name: string;
  locationName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  previewPath: string;
  nfcPath: string;
  joinPath: string;
};

export type ClientBrandingDraft = Omit<
  ClientBranding,
  "id" | "previewPath" | "nfcPath" | "joinPath"
>;

export type PublicClientExperience = {
  business: BusinessContext;
  rewards: Array<{ id: string; name: string; description: string; points: number }>;
  products: PublicProduct[];
  joinPath: string;
  visualSettings: PublicVisualSettings;
};

export type BusinessEnrollment = {
  businessId: string;
  businessName: string;
  locationName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  visualSettings: PublicVisualSettings;
};

export type JoinBusinessPayload = {
  name: string;
  email: string;
  password: string;
};

export type MemberSummary = {
  id: string;
  name: string;
  email: string;
  memberCode: string | null;
  status: "active" | "invited";
  points: number;
  createdAt: string;
};

export type RewardDraft = {
  name: string;
  description: string;
  points: number;
  active: boolean;
  inventoryRemaining: number | null;
};

export type ManagedReward = RewardDraft & {
  id: string;
  archivedAt: string | null;
  redemptionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductDraft = {
  name: string;
  description: string;
  category: string;
  priceCents: number;
  pointsCost: number;
  imageUrl: string | null;
  purchaseUrl: string | null;
  active: boolean;
};

export type PublicProduct = Omit<ProductDraft, "active"> & { id: string };

export type ManagedProduct = ProductDraft & {
  id: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
