import type { LoggerOptions } from 'pino';
import type { LoggerConfig } from './types';

/**
 * Detect the current environment
 */
function getEnvironment(): 'test' | 'development' | 'production' {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return 'test';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export const getLoggerConfig = (): LoggerConfig => {
  const env = getEnvironment();

  // Default log levels per environment
  const defaultLevels = {
    test: 'silent',      // No logs in tests by default
    development: 'debug', // Verbose in development
    production: 'info',   // Moderate in production
  };

  return {
    level: process.env.LOG_LEVEL || defaultLevels[env],
    environment: env,
    redact: [
      'password',
      'token',
      'authorization',
      'cookie',
      'access_token',
      'refresh_token',
      'api_key',
      'secret',
      'private_key',
      'credit_card',
      'ssn',
      'phone',
    ],
  };
};

export const getPinoConfig = (config: LoggerConfig): LoggerOptions => {
  const baseConfig: LoggerOptions = {
    level: config.level,
    redact: {
      paths: config.redact,
      remove: true,
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: {
      level: (label) => ({
        level: label,
      }),
    },
    // Remove pid and hostname from logs completely
    base: undefined,
    serializers: {
      error: (err: Error) => ({
        type: err.constructor.name,
        message: err.message,
        stack: err.stack,
      }),
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        headers: {
          'content-type': req.headers['content-type'],
        },
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.getHeader?.('content-type'),
        },
      }),
    },
  };

  // Use pretty printing in test and development environments
  // Safe to use pino-pretty in test environment (no Next.js worker threads)
  if (config.environment === 'test' || config.environment === 'development') {
    return {
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
          messageFormat: '{msg} {if req.method}[{req.method} {req.url}]{end}',
          errorLikeObjectKeys: ['err', 'error'],
        },
      },
    };
  }

  // Production: JSON format for log aggregation
  return baseConfig;
};
