import type { CSSProperties } from "react";
import type { PublicVisualSettings } from "@/lib/api-client";

export function experienceStyle(settings: PublicVisualSettings | null): CSSProperties | undefined {
  if (!settings) return undefined;
  const radius = { sharp: "4px", soft: "14px", rounded: "26px" }[settings.cornerStyle];
  const headingFont = {
    futuristic: '"Orbitron", "Inter", Arial, sans-serif',
    modern: '"Inter", Arial, sans-serif',
    classic: 'Georgia, "Times New Roman", serif',
  }[settings.fontStyle];
  return {
    "--experience-primary": settings.primaryColor,
    "--experience-accent": settings.accentColor,
    "--client-primary": settings.primaryColor,
    "--client-secondary": settings.accentColor,
    "--business-name-color": settings.businessNameColor,
    "--experience-background": settings.backgroundColor,
    "--experience-surface": settings.surfaceColor,
    "--experience-text": settings.textColor,
    "--experience-muted": settings.mutedColor,
    "--experience-radius": radius,
    "--experience-heading-font": headingFont,
    // Keep the original Elite component tokens synchronized too. Several shared
    // components predate the customer palette and still consume these names.
    "--black": settings.backgroundColor,
    "--black-soft": settings.backgroundColor,
    "--panel": settings.surfaceColor,
    "--panel-high": settings.surfaceColor,
    "--gold": settings.primaryColor,
    "--gold-bright": settings.accentColor,
    "--gold-pale": settings.textColor,
    "--text": settings.textColor,
    "--muted": settings.mutedColor,
    "--cream": settings.textColor,
    "--cyan": settings.accentColor,
    "--blue": settings.primaryColor,
    "--gold-gradient": `linear-gradient(135deg, color-mix(in srgb, ${settings.primaryColor} 28%, white), ${settings.primaryColor})`,
  } as CSSProperties;
}
