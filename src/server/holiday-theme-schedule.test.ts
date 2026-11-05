import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveScheduledTheme } from "./holiday-theme-schedule.ts";

describe("automatic holiday theme schedule", () => {
  it("uses the third Monday in January for MLK Day", () => {
    const result = resolveScheduledTheme(new Date("2026-01-19T17:00:00Z"), "America/New_York");
    assert.equal(result.localDate, "2026-01-19");
    assert.equal(result.active?.key, "mlk-day");
    assert.equal(result.active?.name, "MLK Day");
  });

  it("switches to September 11 Remembrance only on the local date", () => {
    const beforeMidnight = resolveScheduledTheme(
      new Date("2026-09-11T03:30:00Z"),
      "America/New_York",
    );
    const afterMidnight = resolveScheduledTheme(
      new Date("2026-09-11T04:30:00Z"),
      "America/New_York",
    );
    assert.equal(beforeMidnight.localDate, "2026-09-10");
    assert.equal(beforeMidnight.active, null);
    assert.equal(afterMidnight.localDate, "2026-09-11");
    assert.equal(afterMidnight.active?.key, "remembrance-911");
  });

  it("uses Easter Sunday for the spring celebration", () => {
    assert.equal(
      resolveScheduledTheme(new Date("2027-03-28T16:00:00Z"), "America/New_York").active?.key,
      "spring-celebration",
    );
  });

  it("keeps the winter theme active December 24 through 26", () => {
    for (const day of [24, 25, 26]) {
      const result = resolveScheduledTheme(
        new Date(`2026-12-${day}T17:00:00Z`),
        "America/New_York",
      );
      assert.equal(result.active?.key, "winter-holiday");
    }
    assert.equal(
      resolveScheduledTheme(new Date("2026-12-27T17:00:00Z"), "America/New_York").active,
      null,
    );
  });

  it("returns the next scheduled theme when today is not a holiday", () => {
    const result = resolveScheduledTheme(new Date("2026-11-05T17:00:00Z"), "America/New_York");
    assert.equal(result.active, null);
    assert.deepEqual(result.next, {
      key: "winter-holiday",
      name: "Winter Holiday",
      title: "Warm Winter Wishes",
      message: "Wishing our members and community a peaceful, joyful holiday season.",
      dateLabel: "December 24–26",
      localDate: "2026-12-24",
    });
  });

  it("falls back to UTC for invalid legacy timezone data", () => {
    const result = resolveScheduledTheme(new Date("2026-09-11T00:30:00Z"), "Invalid/Zone");
    assert.equal(result.localDate, "2026-09-11");
    assert.equal(result.active?.key, "remembrance-911");
  });

  it("never selects the manually controlled community-event theme", () => {
    for (let month = 0; month < 12; month += 1) {
      const result = resolveScheduledTheme(new Date(Date.UTC(2026, month, 15, 12)), "UTC");
      assert.notEqual(result.active?.key, "community-event");
      assert.notEqual(result.next?.key, "community-event");
    }
  });
});
