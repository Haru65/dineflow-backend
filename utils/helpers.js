const { v4: uuidv4 } = require('uuid');

const generateId = () => uuidv4();

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const generateQRUrl = (restaurantSlug, tableIdentifier) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/order/${restaurantSlug}/${tableIdentifier}`;
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
};

// Convert SQLite DATETIME string (UTC) to ISO format
const formatTimestamp = (sqliteTimestamp) => {
  if (!sqliteTimestamp) return new Date().toISOString();
  // SQLite stores as "YYYY-MM-DD HH:MM:SS" in UTC
  // Convert to ISO 8601 with Z suffix
  const timestamp = sqliteTimestamp.replace(' ', 'T') + 'Z';
  return timestamp;
};

const errorResponse = (res, statusCode, message, details = null) => {
  const response = { error: message };
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  res.status(statusCode).json(response);
};

const successResponse = (res, statusCode, data, message = null) => {
  const response = { data };
  if (message) {
    response.message = message;
  }
  res.status(statusCode).json(response);
};

module.exports = {
  generateId,
  generateSlug,
  generateQRUrl,
  validateEmail,
  sanitizeString,
  formatTimestamp,
  errorResponse,
  successResponse
};
