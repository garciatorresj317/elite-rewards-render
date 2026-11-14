import sharp from "sharp";

export const HIGH_RES_IMAGE_LONG_EDGE = 2048;
export const HIGH_RES_IMAGE_VERSION = 1;
export const PRODUCT_IMAGE_PROCESSING_VERSION = 2;

export type ImageBackgroundOptions =
  | { mode: "original" }
  | { mode: "transparent" }
  | {
      mode: "color";
      color: string;
    };

export type UploadedRasterImage = {
  mime: "image/png" | "image/jpeg" | "image/webp";
  data: Buffer;
};

export type ProcessedRasterImage = {
  mime: "image/webp";
  data: Buffer;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
};

const MAX_INPUT_PIXELS = 50_000_000;
const MAX_LOGO_INPUT_PIXELS = 32_000_000;
const MAX_BACKGROUND_EDIT_PIXELS = 12_000_000;
const WEBP_QUALITIES = [92, 86, 80, 74] as const;
const BACKGROUND_COLOR_DISTANCE = 72;

function hexColor(value: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw Object.assign(new Error("Product background color is invalid"), { status: 400 });
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function colorDistance(data: Buffer, offset: number, color: readonly number[]): number {
  const red = (data[offset] ?? 0) - (color[0] ?? 0);
  const green = (data[offset + 1] ?? 0) - (color[1] ?? 0);
  const blue = (data[offset + 2] ?? 0) - (color[2] ?? 0);
  return Math.sqrt(red * red + green * green + blue * blue);
}

function dominantBorderColor(
  data: Buffer,
  width: number,
  height: number,
): [number, number, number] | null {
  const clusters = new Map<string, { count: number; red: number; green: number; blue: number }>();
  let samples = 0;
  const sample = (pixel: number) => {
    const offset = pixel * 4;
    if ((data[offset + 3] ?? 0) < 32) return;
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    const key = `${red >> 5}:${green >> 5}:${blue >> 5}`;
    const cluster = clusters.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    cluster.count += 1;
    cluster.red += red;
    cluster.green += green;
    cluster.blue += blue;
    clusters.set(key, cluster);
    samples += 1;
  };
  for (let x = 0; x < width; x += 1) {
    sample(x);
    if (height > 1) sample((height - 1) * width + x);
  }
  for (let y = 1; y + 1 < height; y += 1) {
    sample(y * width);
    if (width > 1) sample(y * width + width - 1);
  }
  const ranked = [...clusters.values()].sort((left, right) => right.count - left.count);
  const dominant = ranked[0];
  if (!dominant || dominant.count < Math.max(4, Math.ceil(samples * 0.35))) return null;
  const runnerUp = ranked[1];
  if (runnerUp && runnerUp.count >= dominant.count * 0.8) return null;
  return [
    Math.round(dominant.red / dominant.count),
    Math.round(dominant.green / dominant.count),
    Math.round(dominant.blue / dominant.count),
  ];
}

function replaceEdgeBackground(
  data: Buffer,
  width: number,
  height: number,
  options: Exclude<ImageBackgroundOptions, { mode: "original" }>,
): Buffer {
  const output = Buffer.from(data);
  const replacement = options.mode === "color" ? hexColor(options.color) : null;
  const backgroundColor = dominantBorderColor(data, width, height);
  if (!backgroundColor) return output;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let read = 0;
  let write = 0;
  const enqueue = (pixel: number) => {
    if (pixel < 0 || pixel >= width * height || visited[pixel]) return;
    const offset = pixel * 4;
    if (
      (data[offset + 3] ?? 0) >= 32 &&
      colorDistance(data, offset, backgroundColor) > BACKGROUND_COLOR_DISTANCE
    )
      return;
    visited[pixel] = 1;
    queue[write++] = pixel;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y + 1 < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (read < write) {
    const pixel = queue[read++]!;
    const offset = pixel * 4;
    if (replacement) {
      output[offset] = replacement[0];
      output[offset + 1] = replacement[1];
      output[offset + 2] = replacement[2];
      output[offset + 3] = 255;
    } else {
      output[offset + 3] = 0;
    }
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }
  return output;
}

export async function normalizeUploadedImage(
  input: UploadedRasterImage,
  maxOutputBytes: number,
  label: string,
  background: ImageBackgroundOptions = { mode: "original" },
  maxInputPixels = MAX_INPUT_PIXELS,
): Promise<ProcessedRasterImage> {
  try {
    const oriented = sharp(input.data, {
      failOn: "error",
      limitInputPixels: maxInputPixels,
      sequentialRead: true,
    }).rotate();
    const metadata = await oriented.metadata();
    const sourceWidth = metadata.autoOrient?.width ?? metadata.width;
    const sourceHeight = metadata.autoOrient?.height ?? metadata.height;
    if (!sourceWidth || !sourceHeight)
      throw Object.assign(new Error(`${label} dimensions could not be read`), { status: 400 });
    if (background.mode !== "original" && sourceWidth * sourceHeight > MAX_BACKGROUND_EDIT_PIXELS)
      throw Object.assign(
        new Error(`${label} is too large for background editing; keep the original background`),
        { status: 400 },
      );

    let source = oriented;
    if (background.mode !== "original") {
      const raw = await oriented
        .clone()
        .toColorspace("srgb")
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      source = sharp(replaceEdgeBackground(raw.data, raw.info.width, raw.info.height, background), {
        raw: { width: raw.info.width, height: raw.info.height, channels: 4 },
      });
    }

    let lastOutput: Buffer | null = null;
    let outputWidth = 0;
    let outputHeight = 0;
    for (const quality of WEBP_QUALITIES) {
      const { data, info } = await source
        .clone()
        .resize({
          width: HIGH_RES_IMAGE_LONG_EDGE,
          height: HIGH_RES_IMAGE_LONG_EDGE,
          fit: "inside",
          withoutEnlargement: false,
          kernel: sharp.kernel.lanczos3,
        })
        .sharpen({ sigma: 0.55, m1: 0.5, m2: 0.35 })
        .toColorspace("srgb")
        .webp({ quality, alphaQuality: 100, smartSubsample: true, effort: 5 })
        .toBuffer({ resolveWithObject: true });
      lastOutput = data;
      outputWidth = info.width;
      outputHeight = info.height;
      if (data.length <= maxOutputBytes) {
        return {
          mime: "image/webp",
          data,
          width: info.width,
          height: info.height,
          sourceWidth,
          sourceHeight,
        };
      }
    }

    throw Object.assign(
      new Error(
        `${label} could not be optimized below ${Math.round(maxOutputBytes / 1_048_576)} MB`,
      ),
      { status: 400, outputBytes: lastOutput?.length, outputWidth, outputHeight },
    );
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) throw error;
    throw Object.assign(new Error(`${label} could not be decoded as a valid image`), {
      status: 400,
      cause: error,
    });
  }
}

export async function normalizeUploadedLogo(
  input: UploadedRasterImage,
  maxOutputBytes: number,
): Promise<ProcessedRasterImage> {
  return normalizeUploadedImage(
    input,
    maxOutputBytes,
    "Logo",
    { mode: "original" },
    MAX_LOGO_INPUT_PIXELS,
  );
}
