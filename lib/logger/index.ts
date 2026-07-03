import type { Logger } from 'pino';
import pino from 'pino';
import { getLoggerConfig, getPinoConfig } from './config';
import type { Logger as CustomLogger, ErrorContext, RequestContext, ServiceContext } from './types';

class PinoLoggerWrapper implements CustomLogger {
  constructor(private pinoLogger: Logger) {}

  debug(message: string, context?: Record<string, any>): void {
    this.pinoLogger.debug(context, message);
  }

  info(message: string, context?: Record<string, any>): void {
    this.pinoLogger.info(context, message);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.pinoLogger.warn(context, message);
  }

  error(message: string, context?: ErrorContext): void {
    if (context?.error) {
      const { error, ...rest } = context;
      this.pinoLogger.error(
        {
          ...rest,
          error: error,
        },
        message,
      );
    } else {
      this.pinoLogger.error(context, message);
    }
  }

  fatal(message: string, context?: ErrorContext): void {
    if (context?.error) {
      const { error, ...rest } = context;
      this.pinoLogger.fatal(
        {
          ...rest,
          error: error,
        },
        message,
      );
    } else {
      this.pinoLogger.fatal(context, message);
    }
  }

  child(context: Record<string, any>): CustomLogger {
    return new PinoLoggerWrapper(this.pinoLogger.child(context));
  }
}

let rootLogger: CustomLogger | null = null;

export function createLogger(context?: Record<string, any>): CustomLogger {
  if (!rootLogger) {
    const config = getLoggerConfig();
    const pinoConfig = getPinoConfig(config);
    const pinoInstance = pino(pinoConfig);
    rootLogger = new PinoLoggerWrapper(pinoInstance);
  }

  return context ? rootLogger.child(context) : rootLogger;
}

export function createRequestLogger(context: RequestContext): CustomLogger {
  return createLogger({
    requestId: context.requestId,
    userId: context.userId,
    method: context.method,
    url: context.url,
  });
}

export function createServiceLogger(context: ServiceContext): CustomLogger {
  return createLogger({
    service: context.service,
    operation: context.operation,
    userId: context.userId,
    requestId: context.requestId,
  });
}

// Default logger instance
export const logger = createLogger({ service: 'app' });

// Re-export types
export type { ErrorContext, Logger as CustomLogger, RequestContext, ServiceContext } from './types';
