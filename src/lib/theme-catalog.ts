import type { ThemeKey } from "@/lib/api-client";

export const themeCatalog: Array<{
  key: ThemeKey;
  name: string;
  category: string;
  description: string;
  image: string;
  liveImage?: string;
  live?: boolean;
  quality?: string;
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
    liveImage: "/themes/mlk-day-live.jpg",
  },
  {
    key: "remembrance-911",
    name: "September 11 Remembrance",
    category: "Commemoration",
    description: "A restrained, respectful memorial treatment with twin lights.",
    image: "/themes/remembrance-911.webp",
    liveImage: "/themes/remembrance-911-live.jpg",
  },
  {
    key: "winter-holiday",
    name: "Winter Holiday",
    category: "Holiday",
    description: "An inclusive premium winter celebration in evergreen and gold.",
    image: "/themes/winter-holiday.webp",
    liveImage: "/themes/winter-holiday-live.jpg",
  },
  {
    key: "spring-celebration",
    name: "Spring Celebration",
    category: "Holiday",
    description: "A refined seasonal background with ivory blossoms and gold light.",
    image: "/themes/spring-celebration.webp",
    liveImage: "/themes/spring-celebration-live.jpg",
  },
  {
    key: "community-event",
    name: "Community Event",
    category: "Event",
    description: "A flexible celebration scene for local events and special dates.",
    image: "/themes/community-event.webp",
  },
  {
    key: "cosmic-neon",
    name: "Cosmic Neon",
    category: "Live style",
    description: "Electric cyan and violet energy for modern, high-impact brands.",
    image: "/themes/cosmic-neon.webp",
    live: true,
  },
  {
    key: "royal-purple",
    name: "Royal Purple",
    category: "Live style",
    description: "Deep violet, polished gold, and a premium nightlife atmosphere.",
    image: "/themes/royal-purple.webp",
    live: true,
  },
  {
    key: "ocean-glow",
    name: "Ocean Glow",
    category: "Live style",
    description: "Aqua light, deep blue depth, and a clean luminous finish.",
    image: "/themes/ocean-glow.webp",
    live: true,
  },
  {
    key: "sunset-energy",
    name: "Sunset Energy",
    category: "Live style",
    description: "Warm amber, magenta, and red light for bold customer experiences.",
    image: "/themes/sunset-energy.webp",
    live: true,
  },
  {
    key: "emerald-pulse",
    name: "Emerald Pulse",
    category: "4K live style",
    description: "Emerald and teal light ribbons with restrained gold energy for confident brands.",
    image: "/themes/emerald-pulse.webp",
    live: true,
    quality: "4K",
  },
  {
    key: "ruby-velocity",
    name: "Ruby Velocity",
    category: "4K live style",
    description: "Crimson motion, rose-gold highlights, and a polished high-energy atmosphere.",
    image: "/themes/ruby-velocity.webp",
    live: true,
    quality: "4K",
  },
  {
    key: "arctic-prism",
    name: "Arctic Prism",
    category: "4K live style",
    description: "Ice-blue crystalline light and clean navy depth for a sharp modern finish.",
    image: "/themes/arctic-prism.webp",
    live: true,
    quality: "4K",
  },
  {
    key: "golden-horizon",
    name: "Golden Horizon",
    category: "4K live style",
    description: "Liquid gold, warm amber light, and premium dark space built for luxury brands.",
    image: "/themes/golden-horizon.webp",
    live: true,
    quality: "4K",
  },
];
