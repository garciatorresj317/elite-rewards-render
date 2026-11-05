import type { ThemeKey } from "./experience-service.ts";

export type ScheduledTheme = {
  key: Exclude<ThemeKey, "elite-signature" | "community-event">;
  name: string;
  title: string;
  message: string;
  dateLabel: string;
};

export type ScheduledThemeResolution = {
  active: ScheduledTheme | null;
  next: (ScheduledTheme & { localDate: string }) | null;
  localDate: string;
};

const DEFAULT_TIME_ZONE = "UTC";

function partsFor(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: string | null | undefined): string {
  return value && isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function thirdMondayOfJanuary(year: number): number {
  const firstDay = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const firstMonday = 1 + ((8 - firstDay) % 7);
  return firstMonday + 14;
}

// Gregorian computus, valid for the production calendar range used by Elite Rewards.
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function eventsForYear(
  year: number,
): Array<ScheduledTheme & { localDate: string; endDate?: string }> {
  const easter = easterSunday(year);
  return [
    {
      key: "mlk-day",
      name: "MLK Day",
      title: "Honoring Dr. Martin Luther King Jr.",
      message:
        "A day to reflect on service, unity, and the work of building a more just community.",
      dateLabel: "Third Monday in January",
      localDate: isoDate(year, 1, thirdMondayOfJanuary(year)),
    },
    {
      key: "spring-celebration",
      name: "Spring Celebration",
      title: "A Spring Celebration",
      message: "Wishing our community a season of renewal, connection, and bright beginnings.",
      dateLabel: "Easter Sunday",
      localDate: isoDate(year, easter.month, easter.day),
    },
    {
      key: "remembrance-911",
      name: "September 11 Remembrance",
      title: "September 11 — We Remember",
      message:
        "Honoring the lives lost, the courage shown, and the enduring strength of our communities.",
      dateLabel: "September 11",
      localDate: isoDate(year, 9, 11),
    },
    {
      key: "winter-holiday",
      name: "Winter Holiday",
      title: "Warm Winter Wishes",
      message: "Wishing our members and community a peaceful, joyful holiday season.",
      dateLabel: "December 24–26",
      localDate: isoDate(year, 12, 24),
      endDate: isoDate(year, 12, 26),
    },
  ];
}

export function resolveScheduledTheme(
  now: Date = new Date(),
  requestedTimeZone: string = DEFAULT_TIME_ZONE,
): ScheduledThemeResolution {
  const timeZone = normalizeTimeZone(requestedTimeZone);
  const local = partsFor(now, timeZone);
  const localDate = isoDate(local.year, local.month, local.day);
  const candidates = [...eventsForYear(local.year), ...eventsForYear(local.year + 1)];
  const active =
    candidates.find(
      (event) => localDate >= event.localDate && localDate <= (event.endDate ?? event.localDate),
    ) ?? null;
  const next = candidates.find((event) => event.localDate > localDate) ?? null;
  return {
    active: active
      ? {
          key: active.key,
          name: active.name,
          title: active.title,
          message: active.message,
          dateLabel: active.dateLabel,
        }
      : null,
    next: next
      ? {
          key: next.key,
          name: next.name,
          title: next.title,
          message: next.message,
          dateLabel: next.dateLabel,
          localDate: next.localDate,
        }
      : null,
    localDate,
  };
}

export const automaticThemeSchedule = [
  { name: "MLK Day", dateLabel: "Third Monday in January", themeKey: "mlk-day" as const },
  {
    name: "Spring Celebration",
    dateLabel: "Easter Sunday",
    themeKey: "spring-celebration" as const,
  },
  {
    name: "September 11 Remembrance",
    dateLabel: "September 11",
    themeKey: "remembrance-911" as const,
  },
  { name: "Winter Holiday", dateLabel: "December 24–26", themeKey: "winter-holiday" as const },
];
