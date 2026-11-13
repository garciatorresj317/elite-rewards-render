import sharp from "sharp";

export const HIGH_RES_IMAGE_LONG_EDGE = 2048;
export const HIGH_RES_IMAGE_VERSION = 1;

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
const WEBP_QUALITIES = [92, 86, 80, 74] as const;

export async function normalizeUploadedImage(
  input: UploadedRasterImage,
  maxOutputBytes: number,
  label: string,
): Promise<ProcessedRasterImage> {
  try {
    const source = sharp(input.data, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    }).rotate();
    const metadata = await source.metadata();
    const sourceWidth = metadata.autoOrient?.width ?? metadata.width;
    const sourceHeight = metadata.autoOrient?.height ?? metadata.height;
    if (!sourceWidth || !sourceHeight)
      throw Object.assign(new Error(`${label} dimensions could not be read`), { status: 400 });

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
