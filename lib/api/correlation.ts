import type { NextRequest } from 'next/server';

export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export function getOrCreateCorrelationId(request: NextRequest): string {
  const existingId =
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-request-id') ||
    request.headers.get('request-id');

  return existingId || generateCorrelationId();
}
