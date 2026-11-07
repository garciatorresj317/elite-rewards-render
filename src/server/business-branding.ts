export const DEFAULT_CLIENT_PRIMARY_COLOR = "#F6B900";
export const DEFAULT_CLIENT_SECONDARY_COLOR = "#FFE27A";

export function clientLogoPath(businessId: string, version?: Date | string | null): string {
  const base = `/api/public/clients/${encodeURIComponent(businessId)}/logo`;
  if (!version) return base;
  const value = version instanceof Date ? version.toISOString() : version;
  return `${base}?v=${encodeURIComponent(value)}`;
}
