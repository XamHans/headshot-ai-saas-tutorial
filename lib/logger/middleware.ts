import type { NextRequest } from 'next/server';
import pinoHttp from 'pino-http';
import { getOrCreateCorrelationId } from '../api/correlation';
import { createLogger } from './index';

export interface RequestLoggerOptions {
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  redactPaths?: string[];
}

export function createHttpLogger(options: RequestLoggerOptions = {}) {
  const logger = createLogger({ component: 'http' });

  return pinoHttp({
    logger: logger as any,
    genReqId: (req: any, res: any) => {
      const correlationId = getOrCreateCorrelationId(req as NextRequest);
      res.setHeader('x-correlation-id', correlationId);
      return correlationId;
    },
    customLogLevel: (req: any, res: any, err: any) => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn';
      }
      if (res.statusCode >= 500 || err) {
        return 'error';
      }
      if (res.statusCode >= 300 && res.statusCode < 400) {
        return 'info';
      }
      return 'info';
    },
    serializers: {
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        headers: {
          'content-type': req.headers['content-type'],
        },
        ...(options.includeRequestBody && req.body ? { body: req.body } : {}),
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.getHeader?.('content-type'),
        },
        ...(options.includeResponseBody && res.body ? { body: res.body } : {}),
      }),
    },
    customProps: (req: any, res: any) => ({
      correlationId: req.id,
      service: 'api',
    }),
    redact: options.redactPaths || [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.access_token',
      'req.body.refresh_token',
    ],
  });
}
