import { isDevelopment } from "../config/env";

/**
 * Simple Logger
 * Có thể thay bằng Winston hoặc Pino cho production
 */

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  info(message: string, ...args: any[]) {
    console.log(`[${this.getTimestamp()}] [INFO]`, message, ...args);
  }

  error(message: string, error?: any) {
    console.error(`[${this.getTimestamp()}] [ERROR]`, message, error);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[${this.getTimestamp()}] [WARN]`, message, ...args);
  }

  debug(message: string, ...args: any[]) {
    if (isDevelopment) {
      console.debug(`[${this.getTimestamp()}] [DEBUG]`, message, ...args);
    }
  }

  success(message: string, ...args: any[]) {
    console.log(`[${this.getTimestamp()}] [SUCCESS]`, message, ...args);
  }
}

export const logger = new Logger();
