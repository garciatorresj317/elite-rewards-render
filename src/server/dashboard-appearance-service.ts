import type { SessionUser } from "./auth.ts";
import { getPool } from "./database.ts";

export const dashboardBackgroundStyles = ["orbital", "grid", "aurora"] as const;
export const dashboardInterfaceStyles = ["command", "executive", "minimal"] as const;

export type DashboardBackgroundStyle = (typeof dashboardBackgroundStyles)[number];
export type DashboardInterfaceStyle = (typeof dashboardInterfaceStyles)[number];

export type DashboardAppearance = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  backgroundStyle: DashboardBackgroundStyle;
  interfaceStyle: DashboardInterfaceStyle;
  updatedAt: string | null;
};

export type DashboardAppearanceUpdate = Omit<DashboardAppearance, "updatedAt">;

const defaults: DashboardAppearanceUpdate = {
  primaryColor: "#F6B900",
  accentColor: "#14E6FF",
  backgroundColor: "#020713",
  surfaceColor: "#07111F",
  textColor: "#FFFAF0",
  mutedColor: "#C7BEA8",
  backgroundStyle: "orbital",
  interfaceStyle: "command",
};

function requirePlatformAdmin(user: SessionUser): void {
  if (!user.platformAdmin)
    throw Object.assign(new Error("Platform administrator access required"), { status: 403 });
}

function rowToAppearance(row?: {
  primary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  muted_color: string;
  background_style: DashboardBackgroundStyle;
  interface_style: DashboardInterfaceStyle;
  updated_at: Date | string;
}): DashboardAppearance {
  if (!row) return { ...defaults, updatedAt: null };
  return {
    primaryColor: row.primary_color.toUpperCase(),
    accentColor: row.accent_color.toUpperCase(),
    backgroundColor: row.background_color.toUpperCase(),
    surfaceColor: row.surface_color.toUpperCase(),
    textColor: row.text_color.toUpperCase(),
    mutedColor: row.muted_color.toUpperCase(),
    backgroundStyle: row.background_style,
    interfaceStyle: row.interface_style,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getDashboardAppearance(): Promise<DashboardAppearance> {
  const result = await getPool().query(
    `SELECT primary_color, accent_color, background_color, surface_color,
            text_color, muted_color, background_style, interface_style, updated_at
       FROM platform_dashboard_appearance
      WHERE singleton = true`,
  );
  return rowToAppearance(result.rows[0]);
}

export async function updateDashboardAppearance(
  user: SessionUser,
  input: DashboardAppearanceUpdate,
): Promise<DashboardAppearance> {
  requirePlatformAdmin(user);
  const result = await getPool().query(
    `INSERT INTO platform_dashboard_appearance(
       singleton, primary_color, accent_color, background_color, surface_color,
       text_color, muted_color, background_style, interface_style, updated_at
     ) VALUES (true,$1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT (singleton) DO UPDATE SET
       primary_color = EXCLUDED.primary_color,
       accent_color = EXCLUDED.accent_color,
       background_color = EXCLUDED.background_color,
       surface_color = EXCLUDED.surface_color,
       text_color = EXCLUDED.text_color,
       muted_color = EXCLUDED.muted_color,
       background_style = EXCLUDED.background_style,
       interface_style = EXCLUDED.interface_style,
       updated_at = now()
     RETURNING primary_color, accent_color, background_color, surface_color,
               text_color, muted_color, background_style, interface_style, updated_at`,
    [
      input.primaryColor,
      input.accentColor,
      input.backgroundColor,
      input.surfaceColor,
      input.textColor,
      input.mutedColor,
      input.backgroundStyle,
      input.interfaceStyle,
    ],
  );
  return rowToAppearance(result.rows[0]);
}

export async function resetDashboardAppearance(user: SessionUser): Promise<DashboardAppearance> {
  requirePlatformAdmin(user);
  const result = await getPool().query(
    `INSERT INTO platform_dashboard_appearance(singleton)
     VALUES (true)
     ON CONFLICT (singleton) DO UPDATE SET
       primary_color = $1,
       accent_color = $2,
       background_color = $3,
       surface_color = $4,
       text_color = $5,
       muted_color = $6,
       background_style = $7,
       interface_style = $8,
       updated_at = now()
     RETURNING primary_color, accent_color, background_color, surface_color,
               text_color, muted_color, background_style, interface_style, updated_at`,
    [
      defaults.primaryColor,
      defaults.accentColor,
      defaults.backgroundColor,
      defaults.surfaceColor,
      defaults.textColor,
      defaults.mutedColor,
      defaults.backgroundStyle,
      defaults.interfaceStyle,
    ],
  );
  return rowToAppearance(result.rows[0]);
}
