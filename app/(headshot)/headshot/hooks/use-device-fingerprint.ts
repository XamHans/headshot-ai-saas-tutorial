'use client';

import FingerprintJS from '@fingerprintjs/fingerprintjs';

/**
 * Compute a stable per-browser visitor id using the open-source FingerprintJS
 * (NOT the paid Pro/Cloud SDK). The agent is loaded lazily and memoized so two
 * requests from the same browser session carry the same fingerprint, which the
 * generate route pairs with the request IP for rate limiting.
 *
 * Best-effort: if fingerprinting fails for any reason (privacy tooling, SSR),
 * we resolve to `undefined` so the request still goes through — the IP half of
 * the rate limit still applies.
 */
let cachedVisitorId: string | undefined;
let inFlight: Promise<string | undefined> | undefined;

export async function getDeviceFingerprint(): Promise<string | undefined> {
  if (cachedVisitorId) return cachedVisitorId;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const agent = await FingerprintJS.load();
      const { visitorId } = await agent.get();
      cachedVisitorId = visitorId;
      return visitorId;
    } catch {
      return undefined;
    } finally {
      inFlight = undefined;
    }
  })();

  return inFlight;
}
