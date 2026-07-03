// @deprecated usages should be replaced with @/lib/api/handlers and @/lib/validation/parse
// This file is kept only to prevent build errors in files we haven't refactored yet.
// If you see this file being used, please refactor to the new pattern.

import type { Session as BetterAuthSession } from 'better-auth';
import { type NextRequest, NextResponse } from 'next/server';
import type { CustomLogger } from '@/lib/logger';

/**
 * @deprecated Use Session type from your auth library directly or from handlers
 */
export type Session = BetterAuthSession & {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

/**
 * @deprecated Use Result pattern instead
 */
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

/**
 * @deprecated Use Result pattern instead
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * @deprecated Use parseRequestBody from @/lib/validation/parse
 */
export async function parseRequestBody<T>(request: NextRequest): Promise<T> {
  try {
    return await request.json();
  } catch (error) {
    throw new ApiError(400, 'Invalid JSON body', 'INVALID_JSON');
  }
}

/**
 * @deprecated Use Zod for validation
 */
export function validateRequiredFields(data: Record<string, any>, requiredFields: string[]): void {
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw new ApiError(
      400,
      `Missing required fields: ${missingFields.join(', ')}`,
      'MISSING_FIELDS',
    );
  }
}

/**
 * @deprecated Use withAuth from @/lib/api/handlers
 */
export function withAuthentication<T>(
  handler: any,
): (req: NextRequest, context: any) => Promise<NextResponse<ApiResponse<T>>> {
  return async () => {
    return NextResponse.json(
      { success: false, error: 'Deprecated function called. Please migrate.' },
      { status: 500 },
    );
  };
}

/**
 * @deprecated Moved to @/lib/ai/telemetry
 */
export function withAITelemetry<T>(config: T, options?: any): T {
  console.warn('Using deprecated withAITelemetry. Implement new pattern.');
  return config;
}
