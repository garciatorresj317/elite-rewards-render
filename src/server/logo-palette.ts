import sharp from "sharp";

export const LOGO_PALETTE_VERSION = 1;

export type LogoPalette = {
  businessNameColor: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
};

type Rgb = readonly [number, number, number];
type ColorCluster = {
  count: number;
  red: number;
  green: number;
  blue: number;
};

const WHITE: Rgb = [255, 250, 240];
const BLACK: Rgb = [0, 0, 0];
const SAMPLE_EDGE = 96;

function clamp(channel: number): number {
  return Math.max(0, Math.min(255, Math.round(channel)));
}

function toHex(color: Rgb): string {
  return `#${color.map((channel) => clamp(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mix(first: Rgb, second: Rgb, secondWeight: number): Rgb {
  const weight = Math.max(0, Math.min(1, secondWeight));
  return [
    first[0] * (1 - weight) + second[0] * weight,
    first[1] * (1 - weight) + second[1] * weight,
    first[2] * (1 - weight) + second[2] * weight,
  ];
}

function linearChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: Rgb): number {
  return (
    0.2126 * linearChannel(color[0]) +
    0.7152 * linearChannel(color[1]) +
    0.0722 * linearChannel(color[2])
  );
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function saturation(color: Rgb): number {
  const maximum = Math.max(...color);
  const minimum = Math.min(...color);
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
}

function distance(first: Rgb, second: Rgb): number {
  return Math.sqrt(
    (first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2 + (first[2] - second[2]) ** 2,
  );
}

function readableBrandColor(color: Rgb, background: Rgb, minimumContrast = 4.5): Rgb {
  if (contrastRatio(color, background) >= minimumContrast) return color;
  const toward = luminance(background) < 0.5 ? WHITE : BLACK;
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(color, toward, step / 20);
    if (contrastRatio(candidate, background) >= minimumContrast) return candidate;
  }
  return toward;
}

function clusterColors(
  data: Buffer,
  width: number,
  height: number,
): Array<ColorCluster & { color: Rgb }> {
  const clusters = new Map<string, ColorCluster>();
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    const alpha = data[offset + 3] ?? 0;
    if (alpha < 48) continue;
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    const key = `${red >> 4}:${green >> 4}:${blue >> 4}`;
    const cluster = clusters.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    const weight = alpha / 255;
    cluster.count += weight;
    cluster.red += red * weight;
    cluster.green += green * weight;
    cluster.blue += blue * weight;
    clusters.set(key, cluster);
  }
  return [...clusters.values()].map((cluster) => ({
    ...cluster,
    color: [
      cluster.red / cluster.count,
      cluster.green / cluster.count,
      cluster.blue / cluster.count,
    ],
  }));
}

function chooseLogoColors(clusters: Array<ColorCluster & { color: Rgb }>): [Rgb, Rgb] {
  if (!clusters.length)
    return [
      [246, 185, 0],
      [20, 230, 255],
    ];
  const ranked = [...clusters].sort((left, right) => {
    const leftScore = left.count * (0.35 + saturation(left.color) * 1.65);
    const rightScore = right.count * (0.35 + saturation(right.color) * 1.65);
    return rightScore - leftScore;
  });
  const primary = ranked[0]!.color;
  const accent =
    ranked.find(
      (candidate) =>
        candidate !== ranked[0] &&
        distance(candidate.color, primary) >= 72 &&
        (saturation(candidate.color) >= 0.18 || saturation(primary) < 0.18),
    )?.color ?? mix(primary, luminance(primary) < 0.45 ? WHITE : BLACK, 0.42);
  return [primary, accent];
}

export async function deriveLogoPalette(image: Buffer): Promise<LogoPalette> {
  const sample = await sharp(image, {
    failOn: "error",
    limitInputPixels: 50_000_000,
    sequentialRead: true,
  })
    .rotate()
    .resize({ width: SAMPLE_EDGE, height: SAMPLE_EDGE, fit: "inside", withoutEnlargement: true })
    .toColorspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [logoPrimary, logoAccent] = chooseLogoColors(
    clusterColors(sample.data, sample.info.width, sample.info.height),
  );
  const anchor = saturation(logoPrimary) >= saturation(logoAccent) ? logoPrimary : logoAccent;
  const background = mix(anchor, BLACK, 0.9);
  const surface = mix(anchor, BLACK, 0.8);
  const primary = readableBrandColor(logoPrimary, background, 3);
  const accent = readableBrandColor(logoAccent, background, 3);
  const businessName = readableBrandColor(
    saturation(primary) >= saturation(accent) ? primary : accent,
    background,
    4.5,
  );
  const text = readableBrandColor(WHITE, background, 7);
  const muted = readableBrandColor(mix(text, background, 0.28), background, 3);
  return {
    businessNameColor: toHex(businessName),
    primaryColor: toHex(primary),
    accentColor: toHex(accent),
    backgroundColor: toHex(background),
    surfaceColor: toHex(surface),
    textColor: toHex(text),
    mutedColor: toHex(muted),
  };
}
