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

  it("removes a solid edge-connected background while preserving the product", async () => {
    const input = await sharp({
      create: { width: 120, height: 100, channels: 4, background: "#FFFFFF" },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="40" height="40"><rect width="40" height="40" fill="#E11D48"/></svg>`,
          ),
          left: 40,
          top: 30,
        },
      ])
      .png()
      .toBuffer();
    const output = await normalizeUploadedImage(
      { mime: "image/png", data: input },
      TEN_MEGABYTES,
      "Product image",
      { mode: "transparent" },
    );
    const corner = await sharp(output.data)
      .ensureAlpha()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    const center = await sharp(output.data)
      .ensureAlpha()
      .extract({
        left: Math.floor(output.width / 2),
        top: Math.floor(output.height / 2),
        width: 1,
        height: 1,
      })
      .raw()
      .toBuffer();
    assert.equal(corner[3], 0);
    assert.ok((center[0] ?? 0) > 150);
    assert.equal(center[3], 255);
  });

  it("replaces a solid edge-connected background with the chosen color", async () => {
    const input = await sharp({
      create: { width: 120, height: 100, channels: 4, background: "#FFFFFF" },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="40" height="40"><rect width="40" height="40" fill="#111827"/></svg>`,
          ),
          left: 40,
          top: 30,
        },
      ])
      .png()
      .toBuffer();
    const output = await normalizeUploadedImage(
      { mime: "image/png", data: input },
      TEN_MEGABYTES,
      "Product image",
      { mode: "color", color: "#22C55E" },
    );
    const corner = await sharp(output.data)
      .ensureAlpha()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    assert.ok((corner[1] ?? 0) > (corner[0] ?? 0));
    assert.ok((corner[1] ?? 0) > (corner[2] ?? 0));
    assert.equal(corner[3], 255);
  });

  it("preserves a contrasting product that touches an image edge", async () => {
    const input = await sharp({
      create: { width: 120, height: 100, channels: 4, background: "#FFFFFF" },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="30" height="45"><rect width="30" height="45" fill="#111827"/></svg>`,
          ),
          left: 0,
          top: 28,
        },
      ])
      .png()
      .toBuffer();
    const output = await normalizeUploadedImage(
      { mime: "image/png", data: input },
      TEN_MEGABYTES,
      "Product image",
      { mode: "transparent" },
    );
    const subject = await sharp(output.data)
      .ensureAlpha()
      .extract({ left: 0, top: Math.floor(output.height / 2), width: 1, height: 1 })
      .raw()
      .toBuffer();
    const background = await sharp(output.data)
      .ensureAlpha()
      .extract({ left: output.width - 1, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    assert.equal(subject[3], 255);
    assert.equal(background[3], 0);
  });

  it("fails conservatively when the border has no dominant background color", async () => {
    const input = await sharp({
      create: { width: 100, height: 100, channels: 4, background: "#FFFFFF" },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="100" height="100"><path d="M0 0h50v100H0z" fill="#EF4444"/><path d="M50 0h50v100H50z" fill="#3B82F6"/></svg>`,
          ),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    const output = await normalizeUploadedImage(
      { mime: "image/png", data: input },
      TEN_MEGABYTES,
      "Product image",
      { mode: "transparent" },
    );
    const left = await sharp(output.data)
      .ensureAlpha()
      .extract({ left: 0, top: Math.floor(output.height / 2), width: 1, height: 1 })
      .raw()
      .toBuffer();
    const right = await sharp(output.data)
      .ensureAlpha()
      .extract({ left: output.width - 1, top: Math.floor(output.height / 2), width: 1, height: 1 })
      .raw()
      .toBuffer();
    assert.equal(left[3], 255);
    assert.equal(right[3], 255);
  });

  it("rejects an invalid custom background color", async () => {
    const input = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#FFFFFF" },
    })
      .png()
      .toBuffer();
    await assert.rejects(
      () =>
        normalizeUploadedImage({ mime: "image/png", data: input }, TEN_MEGABYTES, "Product image", {
          mode: "color",
          color: "red",
        }),
      /background color is invalid/,
    );
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
