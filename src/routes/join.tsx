import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BusinessBrand } from "@/components/BusinessBrand";
import { ExperienceBackdrop } from "@/components/ExperienceTheme";
import { PageStatus } from "@/components/PageStatus";
import { PasswordField } from "@/components/PasswordField";
import { useI18n } from "@/i18n";
import { api, type BusinessEnrollment } from "@/lib/api-client";
import { experienceStyle } from "@/lib/experience-style";

type JoinSearch = { ref?: string; business?: string };

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    ...(typeof search["ref"] === "string" ? { ref: search["ref"] } : {}),
    ...(typeof search["business"] === "string" ? { business: search["business"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Join rewards | Elite Rewards" }] }),
  component: JoinRewards,
});

function JoinRewards() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { t, locale, errorMessage } = useI18n();
  const [referralContext, setReferralContext] = useState<{
    businessName: string;
    locationName: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    loyaltyMode: "points" | "visits";
    visualSettings: BusinessEnrollment["visualSettings"];
  } | null>(null);
  const [businessContext, setBusinessContext] = useState<BusinessEnrollment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const referralCode = search.ref ?? "";
  const businessId = search.business ?? "";

  useEffect(() => {
    setError("");
    setBusinessContext(null);
    setReferralContext(null);
    setBusy(true);
    if (!referralCode && !businessId) {
      setError(t("This Join Rewards link is incomplete."));
      setBusy(false);
      return;
    }
    const request = referralCode
      ? api.referralEnrollment(referralCode).then((result) => setReferralContext(result))
      : api.businessEnrollment(businessId).then((result) => setBusinessContext(result));
    request
      .catch((cause) => setError(errorMessage(cause, "Enrollment unavailable")))
      .finally(() => setBusy(false));
  }, [referralCode, businessId, t, errorMessage, reloadKey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (form.password !== form.confirmPassword) {
        setError(t("Passwords do not match"));
        return;
      }
      const payload = { name: form.name, email: form.email, password: form.password };
      if (referralCode) await api.joinReferral({ ...payload, referralCode });
      else await api.joinBusiness(businessId, payload);
      await navigate({ to: "/wallet" });
    } catch (cause) {
      setError(errorMessage(cause, "Enrollment failed"));
    } finally {
      setSubmitting(false);
    }
  }

  const businessName = businessContext?.businessName ?? referralContext?.businessName;
  const locationName = businessContext?.locationName ?? referralContext?.locationName;
  const logoUrl = businessContext?.logoUrl ?? referralContext?.logoUrl ?? null;
  const branding =
    businessContext || referralContext
      ? {
          business_name: businessContext?.businessName ?? referralContext?.businessName ?? "",
          location_name: businessContext?.locationName ?? referralContext?.locationName ?? "",
          logo_url: businessContext?.logoUrl ?? referralContext?.logoUrl ?? null,
          primary_color:
            businessContext?.primaryColor ?? referralContext?.primaryColor ?? "#F6B900",
          secondary_color:
            businessContext?.secondaryColor ?? referralContext?.secondaryColor ?? "#FFE27A",
          loyalty_mode: businessContext?.loyaltyMode ?? referralContext?.loyaltyMode ?? "points",
        }
      : null;
  const style =
    businessContext || referralContext
      ? ({
          ...experienceStyle(
            businessContext?.visualSettings ?? referralContext?.visualSettings ?? null,
          ),
          "--client-primary":
            businessContext?.primaryColor ?? referralContext?.primaryColor ?? "#F6B900",
          "--client-secondary":
            businessContext?.secondaryColor ?? referralContext?.secondaryColor ?? "#FFE27A",
        } as React.CSSProperties)
      : undefined;
  const loyaltyMode = businessContext?.loyaltyMode ?? referralContext?.loyaltyMode ?? "points";
  const visualSettings = businessContext?.visualSettings ?? referralContext?.visualSettings ?? null;
  const localized = (english: string, spanish: string) =>
    locale === "es" ? spanish || english : english;

  if (!busy && error && !businessName) {
    return (
      <PageStatus
        title={t("Enrollment unavailable")}
        message={error}
        retryLabel={t("Try again")}
        {...(referralCode || businessId
          ? { onRetry: () => setReloadKey((value) => value + 1) }
          : {})}
        action={
          <a className="button button-ghost" href="/login?access=member">
            {t("Member sign in")}
          </a>
        }
      />
    );
  }

  return (
    <div
      className={`auth-page business-join-page theme-${businessContext?.visualSettings.themeKey ?? referralContext?.visualSettings.themeKey ?? "elite-signature"}`}
      style={style}
    >
      <ExperienceBackdrop
        settings={businessContext?.visualSettings ?? referralContext?.visualSettings ?? null}
        audience="member"
      />
      {logoUrl && (
        <div className="join-business-watermark" aria-hidden="true">
          <img src={logoUrl} alt="" />
        </div>
      )}
      <div className="join-future-grid" aria-hidden="true" />
      <div className="join-orbit join-orbit-one" aria-hidden="true" />
      <div className="join-orbit join-orbit-two" aria-hidden="true" />
      <header className="wallet-header container-mid themed-surface-content">
        {branding ? <BusinessBrand business={branding} /> : <BrandMark />}
        <a className="back-link" href="/login?access=member">
          {t("Already a member?")}
        </a>
      </header>
      <main className="auth-card referral-join-card themed-surface-content">
        {visualSettings &&
          localized(visualSettings.companySlogan, visualSettings.companySloganEs) && (
            <span className="join-company-slogan">
              {localized(visualSettings.companySlogan, visualSettings.companySloganEs)}
            </span>
          )}
        <h1>
          {(visualSettings &&
            localized(visualSettings.joinHeadline, visualSettings.joinHeadlineEs)) ||
            t("Join {businessName}", { businessName: businessName ?? "Elite Rewards" })}
        </h1>
        {busy && (
          <div className="inline-loading" role="status">
            <span className="status-spinner" aria-hidden="true" />
            <p>{t("Loading your rewards program…")}</p>
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {businessName && locationName && (
          <>
            <div className="activation-summary">
              <strong>{businessName}</strong>
              <span>{locationName}</span>
              <small>
                <Check size={14} />
                {t(referralCode ? "Referred member enrollment" : "Secure member enrollment")}
              </small>
            </div>
            <p>
              {(visualSettings &&
                localized(visualSettings.joinMessage, visualSettings.joinMessageEs)) ||
                (loyaltyMode === "visits"
                  ? t(
                      "Create your private member wallet to view this business’s products, record visits, and redeem available rewards.",
                    )
                  : t(
                      "Create your private member wallet to view this business’s products, earn points, and redeem available rewards.",
                    ))}
            </p>
            <form onSubmit={submit}>
              <label>
                {t("Full name")}
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label>
                {t("Email")}
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>
              <PasswordField
                label="Password"
                autoComplete="new-password"
                value={form.password}
                onChange={(password) => setForm({ ...form, password })}
                showRequirement
              />
              <PasswordField
                label="Confirm password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(confirmPassword) => setForm({ ...form, confirmPassword })}
              />
              <label className="consent-check">
                <input required type="checkbox" />
                <span>
                  {t(
                    "I agree to the business rewards program terms and electronic account access.",
                  )}
                </span>
              </label>
              <button className="admin-primary full" disabled={submitting}>
                {submitting ? t("Creating wallet…") : t("Join rewards")}
              </button>
              <p className="join-privacy-note">
                {t(
                  "Your account is private. This business can manage rewards, but it cannot see your password.",
                )}
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
