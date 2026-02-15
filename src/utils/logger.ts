import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  INFO = 'INFO',
  ERROR = 'ERROR',
  WARN = 'WARN',
  DEBUG = 'DEBUG'
}

class Logger {
  private logFilePath: string | null = null;

  private ensureLogFilePath(): string {
    if (!this.logFilePath) {
      const userDataPath = app.getPath('userData');
      const logsDir = path.join(userDataPath, 'logs');

      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      this.logFilePath = path.join(logsDir, 'app.log');
    }
    return this.logFilePath;
  }

  private writeLog(level: LogLevel, message: string, error?: Error): void {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;

    if (error) {
      logMessage += `\nError: ${error.message}\nStack: ${error.stack}`;
    }

    // Console output in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(logMessage);
    }

    // File output
    try {
      const logPath = this.ensureLogFilePath();
      fs.appendFileSync(logPath, logMessage + '\n');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  info(message: string): void {
    this.writeLog(LogLevel.INFO, message);
  }

  error(message: string, error?: Error): void {
    this.writeLog(LogLevel.ERROR, message, error);
  }

  warn(message: string): void {
    this.writeLog(LogLevel.WARN, message);
  }

  debug(message: string): void {
    this.writeLog(LogLevel.DEBUG, message);
  }
}

export const logger = new Logger();
