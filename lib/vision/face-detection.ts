import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// picojs ships a single CommonJS file that assigns to `module.exports`. No types.
// @ts-expect-error - no type declarations for picojs
import pico from 'picojs';

/**
 * Server-side pre-flight face detection using pico.js (a pure-JS Viola-Jones
 * cascade detector — no native/WASM deps, deterministic, safe in Vitest/Node).
 *
 * This runs BEFORE any R2 upload or DB write and BEFORE any image-generation
 * model is ever contacted, so a bad photo can never cost generation budget and
 * can't be bypassed by a modified client (it's server-only).
 */

/**
 * Minimum accepted image dimension (px, shorter side). Below this a photo is
 * too low-resolution to generate a usable headshot from.
 */
export const MIN_IMAGE_DIMENSION = 128;

/**
 * pico detection score above which a candidate region counts as a face.
 * Tuned against the test fixtures: clear frontal faces score well above this,
 * background noise well below.
 */
const FACE_DETECTION_THRESHOLD = 5.0;

/**
 * A single detected face must score at least this to count as a *clear*,
 * unobstructed, front-facing face. Occlusions (e.g. sunglasses across the
 * eyes) and poorly-lit / off-angle faces detect weakly and fall below this,
 * so they are treated as "no clear face".
 */
const CLEAR_FACE_THRESHOLD = 8.0;

export type FaceGateReason = 'ok' | 'no_face' | 'multiple_faces' | 'low_resolution' | 'undecodable';

export interface FaceGateResult {
  reason: FaceGateReason;
  faceCount: number;
  width: number;
  height: number;
}

let cachedCascade:
  | ((r: number, c: number, s: number, pixels: Uint8Array, ldim: number) => number)
  | null = null;

function getCascade() {
  if (!cachedCascade) {
    const cascadePath = join(process.cwd(), 'lib/vision/models/facefinder');
    const bytes = new Int8Array(readFileSync(cascadePath));
    cachedCascade = pico.unpack_cascade(bytes);
  }
  return cachedCascade;
}

interface GrayImage {
  pixels: Uint8Array;
  width: number;
  height: number;
}

/**
 * Decode an image buffer (JPEG/PNG) into a grayscale pixel array. Uses jimp
 * (pure JS). Returns null if the bytes can't be decoded as an image.
 */
async function decodeToGrayscale(buffer: Buffer): Promise<GrayImage | null> {
  try {
    // jimp v1 exposes named exports; load lazily so the module stays importable
    // even before deps are installed at build time.
    const { Jimp } = await import('jimp');
    const img = await Jimp.read(buffer);
    const { width, height, data } = img.bitmap;
    // `data` is RGBA bytes (4 per pixel). Convert to a single grayscale plane.
    const pixels = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      pixels[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }
    return { pixels, width, height };
  } catch {
    return null;
  }
}

/**
 * Run the pre-flight face gate over raw image bytes.
 *
 * Returns a structured verdict; the service maps it to a friendly Result error.
 * Never throws for expected outcomes (undecodable image → `undecodable`).
 */
export async function runFaceGate(buffer: Buffer): Promise<FaceGateResult> {
  const gray = await decodeToGrayscale(buffer);
  if (!gray) {
    return { reason: 'undecodable', faceCount: 0, width: 0, height: 0 };
  }

  const { pixels, width, height } = gray;

  if (Math.min(width, height) < MIN_IMAGE_DIMENSION) {
    return { reason: 'low_resolution', faceCount: 0, width, height };
  }

  const classify = getCascade();
  const image = { pixels, nrows: height, ncols: width, ldim: width };
  const params = {
    shiftfactor: 0.1,
    minsize: Math.round(Math.min(height, width) * 0.1),
    maxsize: Math.min(height, width),
    scalefactor: 1.1,
  };

  let dets: number[][] = pico.run_cascade(image, classify, params);
  dets = pico.cluster_detections(dets, 0.2);

  // dets entries are [row, col, scale, score]; keep confident detections.
  const faces = dets.filter((d) => d[3] > FACE_DETECTION_THRESHOLD);
  const faceCount = faces.length;

  if (faceCount === 0) {
    return { reason: 'no_face', faceCount: 0, width, height };
  }
  if (faceCount > 1) {
    return { reason: 'multiple_faces', faceCount, width, height };
  }

  // Exactly one candidate — require it to be a *clear*, unobstructed face.
  const topScore = faces[0][3];
  if (topScore < CLEAR_FACE_THRESHOLD) {
    return { reason: 'no_face', faceCount: 1, width, height };
  }

  return { reason: 'ok', faceCount: 1, width, height };
}
