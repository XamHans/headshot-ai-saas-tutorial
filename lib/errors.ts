export const ErrorCode = {
  // Validation (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',

  // Auth (401/403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Not Found (404)
  NOT_FOUND: 'NOT_FOUND',
  POST_NOT_FOUND: 'POST_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',

  // Server (500/502)
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>; // Validation details for client
  cause?: unknown; // Original error for logging
}

// Exhaustive mapping - TypeScript enforces all codes have a status
export const errorCodeToStatus: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_JSON: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  POST_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  PAYMENT_NOT_FOUND: 404,
  DATABASE_ERROR: 500,
  INTERNAL_ERROR: 500,
  EXTERNAL_SERVICE_ERROR: 502,
};
