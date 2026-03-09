/**
 * Centralized Error Handling
 * Provides consistent error responses and logging
 */

const fs = require('fs');
const path = require('path');

// Error log file
const LOG_DIR = path.join(__dirname, '../logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'errors.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Custom error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Log error to file
 */
function logError(error, req = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message: error.message,
    statusCode: error.statusCode || 500,
    stack: error.stack,
    ...(req && {
      request: {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.user?.id,
        tenantId: req.user?.tenantId
      }
    })
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  fs.appendFileSync(ERROR_LOG_FILE, logLine, (err) => {
    if (err) console.error('Failed to write error log:', err);
  });

  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', logEntry);
  }
}

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logError(err, req);

  // Default error response
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    details = err.details;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not found';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    message = 'Conflict';
  } else if (err.code === 'SQLITE_CONSTRAINT') {
    statusCode = 409;
    message = 'Database constraint violation';
  } else if (err.code === 'SQLITE_CANTOPEN') {
    statusCode = 500;
    message = 'Database connection error';
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

/**
 * Async route wrapper to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Unauthorized error
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Not found error
 */
class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error
 */
class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Get error logs
 */
function getErrorLogs(lines = 100) {
  try {
    if (!fs.existsSync(ERROR_LOG_FILE)) {
      return [];
    }

    const content = fs.readFileSync(ERROR_LOG_FILE, 'utf-8');
    const logLines = content.split('\n').filter(line => line.trim());
    return logLines.slice(-lines).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch (err) {
    console.error('Error reading error logs:', err);
    return [];
  }
}

/**
 * Clear error logs
 */
function clearErrorLogs() {
  try {
    if (fs.existsSync(ERROR_LOG_FILE)) {
      fs.unlinkSync(ERROR_LOG_FILE);
    }
  } catch (err) {
    console.error('Error clearing error logs:', err);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  errorHandler,
  asyncHandler,
  logError,
  getErrorLogs,
  clearErrorLogs
};
