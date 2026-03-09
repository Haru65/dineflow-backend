/**
 * Input Validation & Sanitization Utilities
 * Provides middleware and helper functions for validating and sanitizing user input
 */

const { errorResponse } = require('./helpers');

/**
 * Validation rules for common fields
 */
const VALIDATION_RULES = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Invalid email format'
  },
  password: {
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
  },
  slug: {
    pattern: /^[a-z0-9-]+$/,
    message: 'Slug must contain only lowercase letters, numbers, and hyphens'
  },
  identifier: {
    pattern: /^[a-z0-9-]+$/,
    message: 'Identifier must contain only lowercase letters, numbers, and hyphens'
  },
  phone: {
    pattern: /^[\d\s\-\+\(\)]{10,}$/,
    message: 'Invalid phone number format'
  },
  price: {
    pattern: /^\d+(\.\d{1,2})?$/,
    message: 'Price must be a valid number with up to 2 decimal places'
  },
  url: {
    pattern: /^https?:\/\/.+/,
    message: 'Invalid URL format'
  }
};

/**
 * Sanitize string input - remove potentially harmful characters
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>\"']/g, '') // Remove HTML/script tags
    .substring(0, 1000); // Limit length
}

/**
 * Sanitize email
 */
function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Sanitize number
 */
function sanitizeNumber(num) {
  const parsed = parseFloat(num);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Validate email
 */
function validateEmail(email) {
  const sanitized = sanitizeEmail(email);
  return VALIDATION_RULES.email.pattern.test(sanitized);
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < VALIDATION_RULES.password.minLength) return false;
  return VALIDATION_RULES.password.pattern.test(password);
}

/**
 * Validate slug format
 */
function validateSlug(slug) {
  if (typeof slug !== 'string') return false;
  return VALIDATION_RULES.slug.pattern.test(slug);
}

/**
 * Validate identifier format
 */
function validateIdentifier(identifier) {
  if (typeof identifier !== 'string') return false;
  return VALIDATION_RULES.identifier.pattern.test(identifier);
}

/**
 * Validate phone number
 */
function validatePhone(phone) {
  if (typeof phone !== 'string') return false;
  return VALIDATION_RULES.phone.pattern.test(phone);
}

/**
 * Validate price
 */
function validatePrice(price) {
  const num = parseFloat(price);
  return !isNaN(num) && num > 0;
}

/**
 * Validate URL
 */
function validateUrl(url) {
  if (typeof url !== 'string') return false;
  return VALIDATION_RULES.url.pattern.test(url);
}

/**
 * Validate required fields
 */
function validateRequired(obj, fields) {
  const missing = [];
  for (const field of fields) {
    if (!obj[field] || (typeof obj[field] === 'string' && !obj[field].trim())) {
      missing.push(field);
    }
  }
  return missing.length === 0 ? null : missing;
}

/**
 * Validate field length
 */
function validateLength(str, min, max) {
  if (typeof str !== 'string') return false;
  const len = str.trim().length;
  return len >= min && len <= max;
}

/**
 * Middleware: Validate request body
 * Usage: app.use(validateRequestBody(['email', 'password']))
 */
function validateRequestBody(requiredFields = []) {
  return (req, res, next) => {
    if (!req.body) {
      return errorResponse(res, 400, 'Request body is required');
    }

    // Check required fields
    const missing = validateRequired(req.body, requiredFields);
    if (missing) {
      return errorResponse(res, 400, `Missing required fields: ${missing.join(', ')}`);
    }

    // Sanitize all string fields
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }

    next();
  };
}

/**
 * Middleware: Validate query parameters
 */
function validateQueryParams(allowedParams = []) {
  return (req, res, next) => {
    for (const key in req.query) {
      if (!allowedParams.includes(key)) {
        return errorResponse(res, 400, `Invalid query parameter: ${key}`);
      }
    }
    next();
  };
}

/**
 * Middleware: Rate limiting (simple in-memory implementation)
 * For production, use redis-based rate limiting
 */
const rateLimitStore = new Map();

function rateLimit(windowMs = 60000, maxRequests = 100) {
  return (req, res, next) => {
    const key = `${req.ip}-${req.path}`;
    const now = Date.now();
    const userRequests = rateLimitStore.get(key) || [];

    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      return errorResponse(res, 429, 'Too many requests, please try again later');
    }

    recentRequests.push(now);
    rateLimitStore.set(key, recentRequests);

    // Cleanup old entries
    if (rateLimitStore.size > 10000) {
      rateLimitStore.clear();
    }

    next();
  };
}

/**
 * Middleware: Validate JSON content type
 */
function validateContentType(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return errorResponse(res, 400, 'Content-Type must be application/json');
    }
  }
  next();
}

/**
 * Validate object structure
 */
function validateObject(obj, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];

    // Check required
    if (rules.required && !value) {
      errors.push(`${field} is required`);
      continue;
    }

    if (!value) continue;

    // Check type
    if (rules.type && typeof value !== rules.type) {
      errors.push(`${field} must be of type ${rules.type}`);
    }

    // Check pattern
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${field}: ${rules.message || 'Invalid format'}`);
    }

    // Check length
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`${field} must be at least ${rules.minLength} characters`);
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${field} must be at most ${rules.maxLength} characters`);
    }

    // Check enum
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }

    // Check custom validator
    if (rules.validate && !rules.validate(value)) {
      errors.push(`${field}: ${rules.message || 'Invalid value'}`);
    }
  }

  return errors.length === 0 ? null : errors;
}

module.exports = {
  // Sanitizers
  sanitizeString,
  sanitizeEmail,
  sanitizeNumber,

  // Validators
  validateEmail,
  validatePassword,
  validateSlug,
  validateIdentifier,
  validatePhone,
  validatePrice,
  validateUrl,
  validateRequired,
  validateLength,
  validateObject,

  // Middleware
  validateRequestBody,
  validateQueryParams,
  validateContentType,
  rateLimit,

  // Rules
  VALIDATION_RULES
};
