FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY index.js .
COPY database.js .
COPY migrations ./migrations
COPY utils ./utils
COPY routes ./routes
COPY repositories ./repositories

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Run migrations and start server
CMD npm run migrate && npm start
