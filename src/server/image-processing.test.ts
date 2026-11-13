import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { HIGH_RES_IMAGE_LONG_EDGE, normalizeUploadedImage } from "./image-processing.ts";

const TEN_MEGABYTES = 10 * 1024 * 1024;

describe("high-resolution uploaded image processing", () => {
  it("upscales a portrait upload proportionally to a 2048-pixel longest edge", async () => {
    const input = await sharp({
      create: { width: 256, height: 320, channels: 4, background: "#22C55E" },
    })
      .png()
      .toBuffer();

    const output = await normalizeUploadedImage(
      { mime: "image/png", data: input },
      TEN_MEGABYTES,
      "Product image",
    );
    const metadata = await sharp(output.data).metadata();

    assert.equal(output.mime, "image/webp");
    assert.equal(output.sourceWidth, 256);
    assert.equal(output.sourceHeight, 320);
    assert.equal(metadata.width, 1638);
    assert.equal(metadata.height, HIGH_RES_IMAGE_LONG_EDGE);
    assert.ok(output.data.length <= TEN_MEGABYTES);
  });

  it("downscales oversized uploads without stretching and preserves transparency", async () => {
    const input = await sharp({
      create: {
        width: 4096,
        height: 2048,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const output = await normalizeUploadedImage(
      { mime: "image/png", data: input },
      TEN_MEGABYTES,
      "Logo",
    );
    const metadata = await sharp(output.data).metadata();

    assert.equal(metadata.width, HIGH_RES_IMAGE_LONG_EDGE);
    assert.equal(metadata.height, 1024);
    assert.equal(metadata.hasAlpha, true);
  });

  it("rejects a file that only imitates a supported image signature", async () => {
    await assert.rejects(
      () =>
        normalizeUploadedImage(
          { mime: "image/webp", data: Buffer.from("RIFF0000WEBPVP8 ", "ascii") },
          TEN_MEGABYTES,
          "Product image",
        ),
      /could not be decoded/,
    );
  });
});
