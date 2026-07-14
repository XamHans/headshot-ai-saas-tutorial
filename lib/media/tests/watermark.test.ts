import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compositeWatermark } from '../watermark';

/**
 * Build a small solid-color in-memory JPEG to watermark. Cheap, no network.
 */
async function makeTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 140, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('compositeWatermark', () => {
  it('produces a preview smaller than the full image', async () => {
    const input = await makeTestImage(400, 300);
    const { previewBuffer, fullBuffer } = await compositeWatermark(input);

    const previewMeta = await sharp(previewBuffer).metadata();
    const fullMeta = await sharp(fullBuffer).metadata();

    // Full retains original dimensions; preview is downscaled (~50%).
    expect(fullMeta.width).toBe(400);
    expect(fullMeta.height).toBe(300);
    expect(previewMeta.width).toBeLessThan(fullMeta.width ?? 0);
    expect(previewMeta.height).toBeLessThan(fullMeta.height ?? 0);
  });

  it('actually stamps a watermark (preview differs from a plain downscale)', async () => {
    const input = await makeTestImage(400, 300);
    const { previewBuffer } = await compositeWatermark(input);

    // A plain 50% downscale of the same source, no watermark, same encoder path.
    const plainDownscale = await sharp(input).resize(200, 150).jpeg().toBuffer();

    // Compare raw pixel data. If the watermark is a no-op, the two would be
    // (near) identical; the diagonal "PREVIEW" wordmark must change pixels.
    const preview = await sharp(previewBuffer).resize(200, 150).raw().toBuffer();
    const plain = await sharp(plainDownscale).resize(200, 150).raw().toBuffer();

    expect(preview.length).toBe(plain.length);
    let diff = 0;
    for (let i = 0; i < preview.length; i++) {
      if (preview[i] !== plain[i]) diff++;
    }
    // A meaningful fraction of pixels must have changed.
    expect(diff).toBeGreaterThan(preview.length * 0.01);
  });

  it('returns decodable JPEG buffers for both outputs', async () => {
    const input = await makeTestImage(256, 256);
    const { previewBuffer, fullBuffer } = await compositeWatermark(input);

    const previewMeta = await sharp(previewBuffer).metadata();
    const fullMeta = await sharp(fullBuffer).metadata();
    expect(previewMeta.format).toBe('jpeg');
    expect(fullMeta.format).toBe('jpeg');
    expect(previewBuffer.byteLength).toBeGreaterThan(0);
    expect(fullBuffer.byteLength).toBeGreaterThan(0);
  });
});
