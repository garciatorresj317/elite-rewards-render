import { Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link to="/" className="brand-mark" aria-label={t("Elite Rewards home")}>
      <span className="brand-icon">
        <Crown size={compact ? 20 : 27} />
      </span>
      <span className="brand-wordmark">
        <strong>Elite</strong>
        <small>rewards</small>
      </span>
    </Link>
  );
}
