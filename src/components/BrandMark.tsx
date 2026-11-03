import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand-mark" aria-label="Elite rewaerds home">
      <span className="brand-icon">
        <Sparkles size={compact ? 17 : 21} />
      </span>
      <span>
        <strong>Elite</strong> rewaerds
      </span>
    </Link>
  );
}
