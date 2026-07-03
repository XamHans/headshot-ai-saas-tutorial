import type { AppError } from './errors';

// Explicit Result type - no helper functions, just the type
export type Result<T, E = AppError> = { success: true; data: T } | { success: false; error: E };

// Usage is explicit:
// return { success: true, data: user }
// return { success: false, error: { code: 'NOT_FOUND', message: '...' } }
