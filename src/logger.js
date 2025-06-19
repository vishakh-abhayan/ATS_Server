const winston = require('winston');
const { combine, timestamp, printf, colorize, align } = winston.format;

const fileRotateTransport = new winston.transports.File({
  filename: 'logs/app.log',
  maxsize: 10485760, // 10MB
  maxFiles: 5,
  tailable: true,
  zippedArchive: true,
});

const consoleTransport = new winston.transports.Console({
  format: combine(
    colorize({ all: true }),
    timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS A' }),
    align(),
    printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  level: 'info',
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), winston.format.json()),
  transports: [fileRotateTransport],
  exceptionHandlers: [new winston.transports.File({ filename: 'logs/exceptions.log' })],
  rejectionHandlers: [new winston.transports.File({ filename: 'logs/rejections.log' })],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(consoleTransport);
}

module.exports = logger;
