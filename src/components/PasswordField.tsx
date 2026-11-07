import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "@/i18n";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  maxLength?: number;
  showRequirement?: boolean;
};

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength = 8,
  maxLength = 200,
  showRequirement = false,
}: PasswordFieldProps) {
  const { t } = useI18n();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const controlLabel = t(visible ? "Hide password" : "Show password");

  return (
    <label htmlFor={id} className="password-field-label">
      {t(label)}
      <span className="password-input-wrap">
        <input
          id={id}
          required
          type={visible ? "text" : "password"}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-visibility-toggle"
          aria-label={controlLabel}
          title={controlLabel}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </span>
      {showRequirement && (
        <small className="password-requirement">{t("Use at least 8 characters.")}</small>
      )}
    </label>
  );
}
