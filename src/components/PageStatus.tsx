import { LoaderCircle, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

export function PageStatus({
  title,
  message,
  loading = false,
  retryLabel,
  onRetry,
  action,
}: {
  title: string;
  message?: string;
  loading?: boolean;
  retryLabel?: string;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="status-screen" role={loading ? "status" : "alert"} aria-live="polite">
      <div className="status-card">
        {loading && <LoaderCircle className="status-spinner" aria-hidden="true" />}
        <h1>{title}</h1>
        {message && <p>{message}</p>}
        {(onRetry || action) && (
          <div className="status-actions">
            {onRetry && (
              <button type="button" className="button button-dark" onClick={onRetry}>
                <RotateCcw size={17} /> {retryLabel}
              </button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
