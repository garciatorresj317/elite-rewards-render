export type AnniversaryGiftStatus = "planned" | "sent";

export type MembershipAnniversary = {
  membershipStartDate: string;
  nextAnniversaryDate: string;
  milestoneYears: number;
  daysUntil: number;
  isToday: boolean;
  isUpcoming: boolean;
};

type CalendarDate = { year: number; month: number; day: number };

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(value: CalendarDate): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function dateValue(value: CalendarDate): number {
  return Date.UTC(value.year, value.month - 1, value.day);
}

export function calendarDateInTimeZone(value: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: number("year"), month: number("month"), day: number("day") };
}

export function calculateMembershipAnniversary(
  membershipStartedAt: Date,
  now: Date = new Date(),
  timeZone = "UTC",
  upcomingDays = 30,
): MembershipAnniversary {
  const start = calendarDateInTimeZone(membershipStartedAt, timeZone);
  const today = calendarDateInTimeZone(now, timeZone);
  let anniversaryYear = Math.max(today.year, start.year + 1);
  const anniversaryForYear = (year: number): CalendarDate => ({
    year,
    month: start.month,
    day: Math.min(start.day, daysInMonth(year, start.month)),
  });
  let next = anniversaryForYear(anniversaryYear);
  if (dateValue(next) < dateValue(today)) {
    anniversaryYear += 1;
    next = anniversaryForYear(anniversaryYear);
  }
  const daysUntil = Math.round((dateValue(next) - dateValue(today)) / 86_400_000);
  return {
    membershipStartDate: isoDate(start),
    nextAnniversaryDate: isoDate(next),
    milestoneYears: anniversaryYear - start.year,
    daysUntil,
    isToday: daysUntil === 0,
    isUpcoming: daysUntil >= 0 && daysUntil <= upcomingDays,
  };
}
