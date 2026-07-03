export interface LoggerConfig {
  level: string;
  environment: 'test' | 'development' | 'production';
  redact: string[];
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  method: string;
  url: string;
}

export interface ServiceContext {
  service: string;
  operation?: string;
  userId?: string;
  requestId?: string;
}

export interface ErrorContext {
  error: Error;
  context?: Record<string, any>;
  requestId?: string;
  userId?: string;
}

export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: ErrorContext): void;
  fatal(message: string, context?: ErrorContext): void;
  child(context: Record<string, any>): Logger;
}
