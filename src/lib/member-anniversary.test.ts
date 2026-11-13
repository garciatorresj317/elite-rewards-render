import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMembershipAnniversary } from "./member-anniversary.ts";

describe("membership anniversary calculation", () => {
  it("shows the first yearly milestone inside the 30-day window", () => {
    assert.deepEqual(
      calculateMembershipAnniversary(
        new Date("2025-12-01T18:00:00Z"),
        new Date("2026-11-13T15:00:00Z"),
        "America/New_York",
      ),
      {
        membershipStartDate: "2025-12-01",
        nextAnniversaryDate: "2026-12-01",
        milestoneYears: 1,
        daysUntil: 18,
        isToday: false,
        isUpcoming: true,
      },
    );
  });

  it("advances to year two after the first anniversary", () => {
    const anniversary = calculateMembershipAnniversary(
      new Date("2025-10-05T12:00:00Z"),
      new Date("2026-11-13T12:00:00Z"),
      "UTC",
    );
    assert.equal(anniversary.nextAnniversaryDate, "2027-10-05");
    assert.equal(anniversary.milestoneYears, 2);
    assert.equal(anniversary.isUpcoming, false);
  });

  it("celebrates on the business-local anniversary date", () => {
    const anniversary = calculateMembershipAnniversary(
      new Date("2024-11-14T02:00:00Z"),
      new Date("2026-11-14T03:00:00Z"),
      "America/New_York",
    );
    assert.equal(anniversary.membershipStartDate, "2024-11-13");
    assert.equal(anniversary.nextAnniversaryDate, "2026-11-13");
    assert.equal(anniversary.milestoneYears, 2);
    assert.equal(anniversary.isToday, true);
  });

  it("uses February 28 for leap-day anniversaries in non-leap years", () => {
    const anniversary = calculateMembershipAnniversary(
      new Date("2024-02-29T12:00:00Z"),
      new Date("2025-02-28T12:00:00Z"),
      "UTC",
    );
    assert.equal(anniversary.nextAnniversaryDate, "2025-02-28");
    assert.equal(anniversary.isToday, true);
  });

  it("includes day 30 but excludes day 31 from upcoming anniversaries", () => {
    const start = new Date("2025-12-13T12:00:00Z");
    assert.equal(
      calculateMembershipAnniversary(start, new Date("2026-11-13T12:00:00Z"), "UTC").isUpcoming,
      true,
    );
    assert.equal(
      calculateMembershipAnniversary(start, new Date("2026-11-12T12:00:00Z"), "UTC").isUpcoming,
      false,
    );
  });

  it("rolls safely from December into a January anniversary", () => {
    const anniversary = calculateMembershipAnniversary(
      new Date("2024-01-02T12:00:00Z"),
      new Date("2026-12-20T12:00:00Z"),
      "UTC",
    );
    assert.equal(anniversary.nextAnniversaryDate, "2027-01-02");
    assert.equal(anniversary.milestoneYears, 3);
    assert.equal(anniversary.isUpcoming, true);
  });
});
