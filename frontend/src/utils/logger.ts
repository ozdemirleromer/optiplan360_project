/**
 * Production Logger Service
 * Frontend logging stratejisi - console.log temizliği ve production logging
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

type LoggerWindow = Window & {
  __originalConsole?: Console;
};

function stringifyConsoleArg(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

class ProductionLogger {
  private isProduction: boolean;
  private sessionId: string;
  private userId: string | null = null;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor() {
    this.isProduction = import.meta.env.MODE === 'production';
    this.sessionId = this.generateSessionId();
    this.userId = this.getUserId();

    // Production'da console.log'u override et
    if (this.isProduction) {
      this.overrideConsole();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUserId(): string | null {
    // Local storage veya context'ten user ID al
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const parsedUser: unknown = JSON.parse(userStr);
        if (parsedUser && typeof parsedUser === 'object') {
          const user = parsedUser as { id?: unknown; userId?: unknown };
          if (typeof user.id === 'string') return user.id;
          if (typeof user.userId === 'string') return user.userId;
        }
        return null;
      }
    } catch {
      // Silent fail
    }
    return null;
  }

  private overrideConsole(): void {
    const originalConsole = { ...console };
    const loggerWindow = window as LoggerWindow;

    // Console.log'u güvenli hale getir
    console.log = (...args: unknown[]) => {
      this.log(LogLevel.INFO, args.map(stringifyConsoleArg).join(' '), 'console.log', { args });
    };

    console.warn = (...args: unknown[]) => {
      this.log(LogLevel.WARN, args.map(stringifyConsoleArg).join(' '), 'console.warn', { args });
    };

    console.error = (...args: unknown[]) => {
      this.log(LogLevel.ERROR, args.map(stringifyConsoleArg).join(' '), 'console.error', { args });
    };

    console.debug = (...args: unknown[]) => {
      this.log(LogLevel.DEBUG, args.map(stringifyConsoleArg).join(' '), 'console.debug', { args });
    };

    // Original console'u sakla (debug için)
    loggerWindow.__originalConsole = originalConsole;
  }

  private createLogEntry(level: LogLevel, message: string, context?: string, metadata?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId: this.userId || undefined,
      sessionId: this.sessionId,
      metadata
    };
  }

  private log(level: LogLevel, message: string, context?: string, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry(level, message, context, metadata);

    // Buffer'a ekle
    this.logBuffer.push(entry);

    // Buffer boyutunu kontrol et
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }

    // Production'da log'u gönder
    if (this.isProduction) {
      this.sendToRemoteLogging(entry);
    } else {
      // Development'ta console'a yaz
      this.writeToConsole(entry);
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const loggerWindow = window as LoggerWindow;
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const contextPrefix = entry.context ? `[${entry.context}]` : '';
    const fullMessage = `${prefix} ${contextPrefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        loggerWindow.__originalConsole?.debug?.(fullMessage, entry.metadata);
        break;
      case LogLevel.INFO:
        loggerWindow.__originalConsole?.info?.(fullMessage, entry.metadata);
        break;
      case LogLevel.WARN:
        loggerWindow.__originalConsole?.warn?.(fullMessage, entry.metadata);
        break;
      case LogLevel.ERROR:
        loggerWindow.__originalConsole?.error?.(fullMessage, entry.metadata);
        break;
    }
  }

  private async sendToRemoteLogging(entry: LogEntry): Promise<void> {
    try {
      // Remote logging endpoint (production)
      const response = await fetch('/api/v1/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      });

      if (!response.ok) {
        // Hata durumunda development console'a yaz (production'da görünmez)
        (window as LoggerWindow).__originalConsole?.error?.('Failed to send log to remote:', response.status);
      }
    } catch (error) {
      // Network hatası - development console'a yaz
      (window as LoggerWindow).__originalConsole?.error?.('Network error sending log:', error);
    }
  }

  // Public API
  public debug(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }

  public info(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  public warn(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  public error(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, metadata);
  }

  // User action logging
  public logUserAction(action: string, details?: Record<string, unknown>): void {
    this.info(`User action: ${action}`, 'user_action', {
      action,
      ...details
    });
  }

  // Error boundary logging
  public logError(error: Error, errorInfo?: unknown): void {
    this.error(error.message, 'error_boundary', {
      stack: error.stack,
      errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }

  // Performance logging
  public logPerformance(metric: string, duration: number, details?: Record<string, unknown>): void {
    this.info(`Performance: ${metric} - ${duration}ms`, 'performance', {
      metric,
      duration,
      ...details
    });
  }

  // API logging
  public logApiCall(method: string, url: string, status: number, duration: number): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `API ${method} ${url} - ${status}`, 'api', {
      method,
      url,
      status,
      duration
    });
  }

  // Buffer yönetimi
  public getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  public clearLogBuffer(): void {
    this.logBuffer = [];
  }

  public exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }
}

// Singleton instance
const logger = new ProductionLogger();

export default logger;

// Convenience exports
export const logDebug = (message: string, context?: string, metadata?: Record<string, unknown>) =>
  logger.debug(message, context, metadata);

export const logInfo = (message: string, context?: string, metadata?: Record<string, unknown>) =>
  logger.info(message, context, metadata);

export const logWarn = (message: string, context?: string, metadata?: Record<string, unknown>) =>
  logger.warn(message, context, metadata);

export const logError = (message: string, context?: string, metadata?: Record<string, unknown>) =>
  logger.error(message, context, metadata);

export const logUserAction = (action: string, details?: Record<string, unknown>) =>
  logger.logUserAction(action, details);

export const logErrorBoundary = (error: Error, errorInfo?: unknown) =>
  logger.logError(error, errorInfo);

export const logPerformance = (metric: string, duration: number, details?: Record<string, unknown>) =>
  logger.logPerformance(metric, duration, details);

export const logApiCall = (method: string, url: string, status: number, duration: number) =>
  logger.logApiCall(method, url, status, duration);