import type { VisualSettings } from "@/lib/api-client";
import { themeCatalog } from "@/lib/theme-catalog";

export function ExperienceBackdrop({
  settings,
  audience,
}: {
  settings: VisualSettings | null;
  audience: "admin" | "member";
}) {
  if (!settings) return null;
  const theme = themeCatalog.find((item) => item.key === settings.themeKey) ?? themeCatalog[0]!;
  return (
    <>
      <div
        className={`experience-wallpaper experience-${audience}`}
        style={{ backgroundImage: `url(${theme.image})` }}
        aria-hidden="true"
      />
      {(settings.occasionTitle || settings.occasionMessage) && (
        <section
          className={`occasion-banner occasion-${settings.themeKey}`}
          aria-label="Special message"
        >
          <span>{theme.category}</span>
          {settings.occasionTitle && <strong>{settings.occasionTitle}</strong>}
          {settings.occasionMessage && <p>{settings.occasionMessage}</p>}
        </section>
      )}
    </>
  );
}
