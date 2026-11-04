import type { ThemeKey } from "@/lib/api-client";

export const themeCatalog: Array<{
  key: ThemeKey;
  name: string;
  category: string;
  description: string;
  image: string;
}> = [
  {
    key: "elite-signature",
    name: "Elite Signature",
    category: "Always available",
    description: "The black-and-gold Elite Rewards base experience.",
    image: "/themes/elite-signature.webp",
  },
  {
    key: "mlk-day",
    name: "MLK Day",
    category: "Commemoration",
    description: "A dignified theme centered on unity, hope, and forward movement.",
    image: "/themes/mlk-day.webp",
  },
  {
    key: "remembrance-911",
    name: "September 11 Remembrance",
    category: "Commemoration",
    description: "A restrained, respectful memorial treatment with twin lights.",
    image: "/themes/remembrance-911.webp",
  },
  {
    key: "winter-holiday",
    name: "Winter Holiday",
    category: "Holiday",
    description: "An inclusive premium winter celebration in evergreen and gold.",
    image: "/themes/winter-holiday.webp",
  },
  {
    key: "spring-celebration",
    name: "Spring Celebration",
    category: "Holiday",
    description: "A refined seasonal background with ivory blossoms and gold light.",
    image: "/themes/spring-celebration.webp",
  },
  {
    key: "community-event",
    name: "Community Event",
    category: "Event",
    description: "A flexible celebration scene for local events and special dates.",
    image: "/themes/community-event.webp",
  },
];
