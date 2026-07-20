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
 * Build a tiled, diagonal "PREVIEW" wordmark SVG sized to the given image.
 * The text is repeated across a rotated grid so it can't be trivially cropped
 * out, and rendered at low opacity so the preview stays legible.
 */
function buildWatermarkSvg(width: number, height: number): Buffer {
  // Scale the font to the image so the wordmark reads at any size.
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.12));
  const stepX = fontSize * 8;
  const stepY = fontSize * 4;

  // Cover the rotated plane generously so the diagonal tiling fills corners.
  const texts: string[] = [];
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      texts.push(
        `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff" fill-opacity="${WATERMARK_OPACITY}">PREVIEW</text>`,
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <g transform="rotate(-35 ${width / 2} ${height / 2})">
      ${texts.join('\n')}
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
