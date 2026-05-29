const winston = require('winston');

const NODE_ENV = process.env.NODE_ENV || 'development';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} ${level}: ${stack || message}${metaStr}`;
          })
        )
  ),
  transports: [
    new winston.transports.Console(),
  ],
  // Don't exit on uncaught exceptions — let the process handler deal with it
  exitOnError: false,
});

// Silence logs during tests to keep test output clean
if (NODE_ENV === 'test') {
  logger.silent = true;
}

module.exports = logger;
