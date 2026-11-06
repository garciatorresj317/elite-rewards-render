import { Store } from "lucide-react";
import type { CSSProperties } from "react";
import { useI18n } from "@/i18n";
import type { BusinessContext } from "@/lib/api-client";
export function BusinessBrand({
  business,
  compact = false,
}: {
  business: BusinessContext;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const style = {
    "--client-primary": business.primary_color,
    "--client-secondary": business.secondary_color,
  } as CSSProperties;
  return (
    <div className={`business-brand ${compact ? "compact" : ""}`} style={style}>
      {business.logo_url ? (
        <img
          src={business.logo_url}
          alt={t("{businessName} logo", { businessName: business.business_name })}
        />
      ) : (
        <span>
          <Store />
        </span>
      )}
      <div>
        <strong>{business.business_name}</strong>
        <small>{t("Powered by Elite Rewards")}</small>
      </div>
    </div>
  );
}
