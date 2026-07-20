import sharp from 'sharp';

export interface WatermarkResult {
  /** Downscaled, watermarked preview — safe to show pre-payment. */
  previewBuffer: Buffer;
  /** Clean, full-resolution image — NEVER exposed before payment. */
  fullBuffer: Buffer;
}

/** Preview is downscaled to this fraction of the original dimensions. */
const PREVIEW_SCALE = 0.5;
/** Watermark text opacity. */
const WATERMARK_OPACITY = 0.3;

/**
 * Stroke polylines for each letter of the wordmark, drawn on a 60×100 grid
 * (x right, y down). Rendered as SVG paths — NOT `<text>` — because SVG text
 * needs fontconfig + system fonts, which serverless runtimes (Vercel Lambda)
 * don't ship; there `<text>` silently renders as nothing.
 */
const LETTER_STROKES: Record<string, number[][][]> = {
  P: [
    [
      [0, 100],
      [0, 0],
      [55, 0],
      [55, 50],
      [0, 50],
    ],
  ],
  R: [
    [
      [0, 100],
      [0, 0],
      [55, 0],
      [55, 50],
      [0, 50],
    ],
    [
      [35, 50],
      [60, 100],
    ],
  ],
  E: [
    [
      [60, 0],
      [0, 0],
      [0, 100],
      [60, 100],
    ],
    [
      [0, 50],
      [45, 50],
    ],
  ],
  V: [
    [
      [0, 0],
      [30, 100],
      [60, 0],
    ],
  ],
  I: [
    [
      [30, 0],
      [30, 100],
    ],
  ],
  W: [
    [
      [0, 0],
      [15, 100],
      [30, 35],
      [45, 100],
      [60, 0],
    ],
  ],
};

/** Horizontal advance per letter on the 60×100 grid (letter width + gap). */
const LETTER_ADVANCE = 85;

/** One "PREVIEW" wordmark as a single path `d` on the 60×100-per-letter grid. */
const WORDMARK_D = 'PREVIEW'
  .split('')
  .flatMap((letter, i) =>
    LETTER_STROKES[letter].map(
      (stroke) => `M${stroke.map(([px, py]) => `${px + i * LETTER_ADVANCE},${py}`).join('L')}`,
    ),
  )
  .join('');

/** Wordmark width in grid units (letters advance 85, last letter is 60 wide). */
const WORDMARK_WIDTH = ('PREVIEW'.length - 1) * LETTER_ADVANCE + 60;

/**
 * Build a tiled, diagonal "PREVIEW" wordmark SVG sized to the given image.
 * The wordmark is repeated across a rotated grid so it can't be trivially
 * cropped out, and rendered at low opacity so the preview stays legible.
 */
function buildWatermarkSvg(width: number, height: number): Buffer {
  // Scale the wordmark to the image so it reads at any size ("fontSize" is
  // the letter height in px; the 60×100 grid is scaled down to match).
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.12));
  const scale = fontSize / 100;
  const stepX = Math.ceil(WORDMARK_WIDTH * scale) + fontSize * 2;
  const stepY = fontSize * 4;

  // Cover the rotated plane generously so the diagonal tiling fills corners.
  const marks: string[] = [];
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      marks.push(
        `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${WORDMARK_D}" fill="none" stroke="#ffffff" stroke-opacity="${WATERMARK_OPACITY}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></g>`,
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <g transform="rotate(-35 ${width / 2} ${height / 2})">
      ${marks.join('\n')}
    </g>
  </svg>`;

  return Buffer.from(svg);
}

/**
 * Split one clean generated image into:
 *   - `fullBuffer`: the clean full-resolution image (re-encoded as JPEG).
 *   - `previewBuffer`: a ~50% downscaled copy with a diagonal, tiled "PREVIEW"
 *     wordmark composited over it at low opacity.
 *
 * Pure function — no network, no storage. The service uploads the two buffers
 * to separate R2 keys; only the preview is ever surfaced before payment.
 */
export async function compositeWatermark(cleanImageBuffer: Buffer): Promise<WatermarkResult> {
  const base = sharp(cleanImageBuffer);
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!width || !height) {
    throw new Error('compositeWatermark: could not read image dimensions');
  }

  // Full-res clean copy (re-encoded via sharp — consistent JPEG output).
  const fullBuffer = await sharp(cleanImageBuffer).jpeg({ quality: 92 }).toBuffer();

  // Downscaled preview dimensions (~50%), at least 1px.
  const previewWidth = Math.max(1, Math.round(width * PREVIEW_SCALE));
  const previewHeight = Math.max(1, Math.round(height * PREVIEW_SCALE));

  const svg = buildWatermarkSvg(previewWidth, previewHeight);

  const previewBuffer = await sharp(cleanImageBuffer)
    .resize(previewWidth, previewHeight)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 82 })
    .toBuffer();

  return { previewBuffer, fullBuffer };
}
