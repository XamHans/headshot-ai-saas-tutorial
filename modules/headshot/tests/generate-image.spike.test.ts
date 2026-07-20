// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { server } from '@/tests/setup';
import { generateHeadshotImage } from '../services/headshot-generator';
import { getHeadshotStyle } from '../styles';

/**
 * Spike test: exercises the REAL Gemini image-to-image call. This is the
 * riskiest unknown in the slice, so it is verified against the live API (not a
 * mock). It makes a real, billed Gemini call (~$0.04) and can take real
 * wall-clock time — that is intended.
 *
 * Fixture note: `portrait-source.jpg` is a plain, forward-facing portrait that
 * both passes the pre-flight face gate AND that Gemini reliably edits into a
 * headshot. The `single-face.jpg` fixture (a stylised costume portrait) passes
 * the face gate but the image model refuses to edit it (`finishReason:
 * IMAGE_OTHER`), so it is unsuitable for the live-generation path.
 *
 * The Gemini key lives in `.env.local` (Next.js loads it automatically at
 * runtime); the vitest setup only loads `.env`, so we load `.env.local` here.
 */
try {
  (process as { loadEnvFile?: (p: string) => void }).loadEnvFile?.('.env.local');
} catch {
  // fall back to ambient env
}

const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');

describe('generateHeadshotImage (live Gemini spike)', () => {
  // The global MSW server (tests/setup.ts) mocks the Gemini endpoint and returns
  // a text-only "Mock response" with no image — which would defeat this live
  // spike. Stop MSW for this file so the real API call goes through, then
  // restore it afterwards so other test files keep their mocks.
  beforeAll(() => {
    server.close();
  });
  afterAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' });
  });

  it(
    'returns a non-empty image buffer with an image/* media type',
    { timeout: 60_000 },
    async () => {
      const source = readFileSync(join(FIXTURES, 'portrait-source.jpg'));
      const style = getHeadshotStyle('corporate-linkedin');
      if (!style) throw new Error('expected corporate-linkedin style to exist');

      const result = await generateHeadshotImage({
        sourceBuffer: source,
        sourceMediaType: 'image/jpeg',
        prompt: style.prompt,
        telemetry: { userId: 'spike-user', jobId: 'spike-job', styleId: style.id },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mediaType).toMatch(/^image\//);
        expect(result.data.buffer.byteLength).toBeGreaterThan(1000);
      }
    },
  );
});
