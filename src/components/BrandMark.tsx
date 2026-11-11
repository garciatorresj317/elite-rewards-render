import { Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link
      to="/"
      className={`brand-mark${compact ? " brand-mark-compact" : ""}`}
      aria-label={t("Elite Rewards home")}
    >
      <img
        className="brand-logo"
        src="/elite-rewards-logo.webp"
        alt=""
        width={compact ? 126 : 168}
        height={compact ? 84 : 112}
      />
    </Link>
  );
}
