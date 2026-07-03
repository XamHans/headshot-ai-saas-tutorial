import type { z } from 'zod';
import type { AppError } from '@/lib/errors';
import type { Result } from '@/lib/result';

export function parseWith<T extends z.ZodSchema>(schema: T, data: unknown): Result<z.infer<T>> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: {
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    },
  };
}

export async function parseRequestBody<T extends z.ZodSchema>(
  request: Request,
  schema: T,
): Promise<Result<z.infer<T>>> {
  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return {
      success: false,
      error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } as AppError,
    };
  }

  return parseWith(schema, json);
}

export function parseSearchParams<T extends z.ZodSchema>(
  url: string,
  schema: T,
): Result<z.infer<T>> {
  const { searchParams } = new URL(url);
  return parseWith(schema, Object.fromEntries(searchParams));
}
