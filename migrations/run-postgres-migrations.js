require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runPostgresMigrations() {
  try {
    console.log('🔧 Running PostgreSQL migrations...');
    
    const client = await pool.connect();
    
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get list of executed migrations
    const executedResult = await client.query('SELECT filename FROM migrations');
    const executedMigrations = executedResult.rows.map(row => row.filename);
    
    // Get all migration files
    const migrationsDir = __dirname;
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    for (const file of migrationFiles) {
      if (executedMigrations.includes(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }
      
      console.log(`🔄 Executing ${file}...`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      try {
        for (const statement of statements) {
          if (statement.trim()) {
            await client.query(statement.trim());
          }
        }
        
        // Mark migration as executed
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
        console.log(`✅ Completed ${file}`);
        
      } catch (error) {
        console.error(`❌ Failed to execute ${file}:`, error.message);
        throw error;
      }
    }
    
    client.release();
    await pool.end();
    
    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runPostgresMigrations();