export type SessionUser = {
  id: string;
  businessId: string;
  locationId: string | null;
  role: "owner" | "staff" | "member";
  name: string;
  email: string;
  memberCode: string | null;
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
  award: (payload: { memberId: string; points: number; amountCents: number; note?: string }) =>
    request<{ id: string; duplicate: boolean }>("/api/admin/award", {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(payload),
    }),
  wallet: () => request<WalletData>("/api/wallet"),
  redeem: (rewardId: string) =>
    request<{ id: string; code: string; duplicate: boolean }>("/api/wallet/redeem", {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ rewardId }),
    }),
};

export type DashboardData = {
  business: { business_name: string; location_name: string };
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
  context: { business_name: string; location_name: string };
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
};
