import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accessiblePalette } from "./api.ts";

const validPalette = {
  businessNameColor: "#66CCFF",
  primaryColor: "#F6B900",
  accentColor: "#14E6FF",
  backgroundColor: "#020713",
  surfaceColor: "#07111F",
  textColor: "#FFFAF0",
  mutedColor: "#C7BEA8",
};

describe("client appearance palette validation", () => {
  it("accepts a strict accessible business-name color", () => {
    assert.equal(accessiblePalette(validPalette).businessNameColor, "#66CCFF");
  });

  it("rejects malformed business-name colors", () => {
    for (const businessNameColor of ["#FFF", "#11223344", "royalblue", "#ZZZZZZ"])
      assert.throws(() => accessiblePalette({ ...validPalette, businessNameColor }), /invalid/i);
  });

  it("rejects a business-name color below 4.5 to 1 contrast", () => {
    assert.throws(
      () =>
        accessiblePalette({
          ...validPalette,
          businessNameColor: "#777777",
        }),
      /Business name and background need more contrast/,
    );
  });
});
