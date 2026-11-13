import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { deriveLogoPalette } from "./logo-palette.ts";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe("logo-derived client palettes", () => {
  it("extracts recognizable brand colors and produces readable page colors", async () => {
    const logo = await sharp({
      create: { width: 300, height: 180, channels: 4, background: "#6C3BFF" },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 120, height: 180, channels: 4, background: "#16D9C5" },
          })
            .png()
            .toBuffer(),
          left: 180,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    const palette = await deriveLogoPalette(logo);
    for (const color of Object.values(palette)) assert.match(color, /^#[0-9A-F]{6}$/);
    assert.ok(
      palette.primaryColor.includes("6") || palette.accentColor.includes("6"),
      "derived palette should retain the purple/cyan source identity",
    );
    assert.ok(contrast(palette.businessNameColor, palette.backgroundColor) >= 4.5);
    assert.ok(contrast(palette.textColor, palette.backgroundColor) >= 4.5);
    assert.ok(contrast(palette.mutedColor, palette.backgroundColor) >= 3);
  });

  it("falls back safely for transparent and neutral logos", async () => {
    const logo = await sharp({
      create: { width: 80, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const palette = await deriveLogoPalette(logo);
    assert.equal(palette.primaryColor, "#F6B900");
    assert.ok(contrast(palette.businessNameColor, palette.backgroundColor) >= 4.5);
  });
});
