import { Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand-mark" aria-label="Elite rewaerds home">
      <span className="brand-icon">
        <Crown size={compact ? 20 : 27} />
      </span>
      <span className="brand-wordmark">
        <strong>Elite</strong>
        <small>rewaerds</small>
      </span>
    </Link>
  );
}
