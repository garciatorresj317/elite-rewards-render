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
  } as CSSProperties;
}
