export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel) {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message), ...args);
    }
  }
}

export const logger = Logger.getInstance();

// Set log level based on environment
if (process.env.NODE_ENV === 'development') {
  logger.setLevel(LogLevel.DEBUG);
} else {
  logger.setLevel(LogLevel.INFO);
}
