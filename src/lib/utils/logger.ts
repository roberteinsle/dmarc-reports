/**
 * Simple logging utility
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function log(level: LogLevel, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;

  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

export const logger = {
  info: (message: string, data?: any) => log('INFO', message, data),
  warn: (message: string, data?: any) => log('WARN', message, data),
  error: (message: string, data?: any) => log('ERROR', message, data),
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      log('DEBUG', message, data);
    }
  },
};
