# 🗄️ Local PostgreSQL Setup Guide

Your current database URL is pointing to a cloud database that's not accessible. Let's set up a local PostgreSQL database for development.

## PostgreSQL Installation & Setup

### Step 1: Install PostgreSQL

1. **Download PostgreSQL**:
   - Go to [postgresql.org/download](https://www.postgresql.org/download/)
   - Download PostgreSQL for Windows
   - Install with default settings
   - **Remember the password** you set for 'postgres' user during installation

2. **Verify Installation**:
   ```bash
   # Check if PostgreSQL is running
   pg_isready -h localhost -p 5432
   ```

### Step 2: Create Database and User

1. **Open Command Prompt as Administrator**
2. **Connect to PostgreSQL**:
   ```bash
   psql -U postgres -h localhost
   ```
   Enter the password you set during installation.

3. **Create Database and User**:
   ```sql
   -- Create database
   CREATE DATABASE dineflow;
   
   -- Create user with password
   CREATE USER dineflow_user WITH PASSWORD 'dineflow_password';
   
   -- Grant all privileges
   GRANT ALL PRIVILEGES ON DATABASE dineflow TO dineflow_user;
   
   -- Exit psql
   \q
   ```

### Step 3: Update Environment Configuration

Update your `.env` file with the correct database URL:

```env
DATABASE_URL=postgresql://dineflow_user:dineflow_password@localhost:5432/dineflow
```

Or if you prefer to use the default postgres user:

```env
DATABASE_URL=postgresql://postgres:your_postgres_password@localhost:5432/dineflow
```

### Step 4: Test Database Connection

```bash
npm run test-db
```

### Step 5: Run Database Migrations

```bash
npm run migrate-postgres
```

### Step 6: Start the Server

```bash
npm start
```

## Alternative: Docker PostgreSQL

If you have Docker installed:

```bash
# Run PostgreSQL container
docker run --name dineflow-postgres \
  -e POSTGRES_DB=dineflow \
  -e POSTGRES_USER=dineflow_user \
  -e POSTGRES_PASSWORD=dineflow_password \
  -p 5432:5432 \
  -d postgres:13

# Update .env file
DATABASE_URL=postgresql://dineflow_user:dineflow_password@localhost:5432/dineflow
```

## Troubleshooting

### PostgreSQL Service Not Running?
- Open Windows Services (services.msc)
- Find "postgresql-x64-13" (or similar)
- Start the service if it's stopped

### Connection Refused?
- Check if PostgreSQL is listening on port 5432:
  ```bash
  netstat -an | findstr 5432
  ```
- Verify PostgreSQL service is running

### Authentication Failed?
- Double-check username and password in DATABASE_URL
- Make sure the user has proper permissions on the database

### Port Already in Use?
- Check what's using port 5432:
  ```bash
  netstat -ano | findstr 5432
  ```
- Stop conflicting services or change PostgreSQL port

## Quick Test Commands

```bash
# Test database connection
npm run test-db

# Connect directly with psql
psql -U dineflow_user -h localhost -d dineflow

# Check PostgreSQL version
psql -U postgres -c "SELECT version();"
```

## Next Steps

Once PostgreSQL is set up:

1. **Test connection**: `npm run test-db`
2. **Run migrations**: `npm run migrate-postgres`
3. **Start server**: `npm start`
4. **Test menu images**: `npm run test-free-images`