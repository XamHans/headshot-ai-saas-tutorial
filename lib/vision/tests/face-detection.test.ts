import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runFaceGate } from '../face-detection';

const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');

function fixture(name: string): Buffer {
  return readFileSync(join(FIXTURES, name));
}

describe('runFaceGate', () => {
  it('accepts a clear single front-facing face', async () => {
    const result = await runFaceGate(fixture('single-face.jpg'));
    expect(result.reason).toBe('ok');
    expect(result.faceCount).toBe(1);
  });

  it('rejects a photo with no detectable face', async () => {
    const result = await runFaceGate(fixture('no-face.jpg'));
    expect(result.reason).toBe('no_face');
    expect(result.faceCount).toBe(0);
  });

  it('rejects a photo with multiple faces', async () => {
    const result = await runFaceGate(fixture('multiple-faces.jpg'));
    expect(result.reason).toBe('multiple_faces');
    expect(result.faceCount).toBeGreaterThan(1);
  });

  it('rejects a face obscured by sunglasses as not clear', async () => {
    const result = await runFaceGate(fixture('sunglasses.jpg'));
    expect(result.reason).toBe('no_face');
  });

  it('rejects an undecodable (non-image) buffer', async () => {
    const result = await runFaceGate(Buffer.from('this is not an image'));
    expect(result.reason).toBe('undecodable');
  });
});
