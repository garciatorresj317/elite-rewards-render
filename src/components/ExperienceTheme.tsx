import { useI18n } from "@/i18n";
import type { PublicVisualSettings } from "@/lib/api-client";
import { themeCatalog } from "@/lib/theme-catalog";
export function ExperienceBackdrop({
  settings,
  audience,
}: {
  settings: PublicVisualSettings | null;
  audience: "admin" | "member";
}) {
  const { t } = useI18n();
  if (!settings) return null;
  const theme = themeCatalog.find((item) => item.key === settings.themeKey) ?? themeCatalog[0]!;
  const backgroundImage =
    settings.automaticThemeActive && theme.liveImage ? theme.liveImage : theme.image;
  return (
    <>
      <div
        className={`experience-wallpaper experience-${audience} ${settings.automaticThemeActive ? "is-automatic-live-theme" : ""}`}
        style={{ backgroundImage: `url(${backgroundImage})` }}
        aria-hidden="true"
      >
        <span className="experience-light-sweep" />
        <span className="experience-atmosphere" />
        <span className="experience-particles" />
      </div>
      {(settings.occasionTitle || settings.occasionMessage) && (
        <section
          className={`occasion-banner occasion-${settings.themeKey}`}
          aria-label={t("Special message")}
        >
          <span>{t(theme.category)}</span>
          {settings.automaticThemeActive && <em>{t("Live holiday theme")}</em>}
          {settings.occasionTitle && <strong>{settings.occasionTitle}</strong>}
          {settings.occasionMessage && <p>{settings.occasionMessage}</p>}
        </section>
      )}
    </>
  );
}
