import { type NextRequest, NextResponse } from 'next/server';
import { getOrCreateCorrelationId } from '@/lib/api/correlation';

export function middleware(request: NextRequest) {
  const correlationId = getOrCreateCorrelationId(request);

  const response = NextResponse.next();
  response.headers.set('x-correlation-id', correlationId);

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
