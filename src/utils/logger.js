const winston = require('winston');

// Configure the logger with AWS Lambda-friendly settings
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'document-processor' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add request context if available
const addRequestContext = (context = {}) => {
  const { awsRequestId, functionName, functionVersion } = context;
  logger.defaultMeta = {
    ...logger.defaultMeta,
    awsRequestId,
    functionName,
    functionVersion
  };
};

module.exports = {
  logger,
  addRequestContext
}; 