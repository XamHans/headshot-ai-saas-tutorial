import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { type AppError, errorCodeToStatus } from '@/lib/errors';
import type { Result } from '@/lib/result';

export type RouteContext = {
  params: Promise<Record<string, string | string[]>>;
};

export type Session = {
  user: { id: string; email: string; name: string };
};

// API response types
export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  code: string;
  error: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Convert Result to HTTP Response
export function handleResult<T>(
  result: Result<T>,
  successStatus = 200,
): NextResponse<ApiResponse<T>> {
  if (result.success) {
    return NextResponse.json({ success: true, data: result.data }, { status: successStatus });
  }

  const { code, message, details } = result.error;
  const status = errorCodeToStatus[code];

  // Log cause server-side if present (don't send to client)
  if (result.error.cause) {
    console.error(`[${code}]`, result.error.cause);
  }

  return NextResponse.json({ success: false, code, error: message, details }, { status });
}

// Authenticated route handler
export function withAuth<T>(
  handler: (session: Session, req: NextRequest, ctx: RouteContext) => Promise<Result<T>>,
) {
  return async (req: NextRequest, ctx: RouteContext): Promise<NextResponse<ApiResponse<T>>> => {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return handleResult<T>({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const result = await handler(session, req, ctx);
    return handleResult(result);
  };
}

// Public route handler
export function withHandler<T>(
  handler: (req: NextRequest, ctx: RouteContext) => Promise<Result<T>>,
) {
  return async (req: NextRequest, ctx: RouteContext): Promise<NextResponse<ApiResponse<T>>> => {
    const result = await handler(req, ctx);
    return handleResult(result);
  };
}
