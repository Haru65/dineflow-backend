const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('../database');

async function runMigrations() {
  console.log('Starting migrations...');
  
  try {
    const db = await initializeDatabase();
    
    // Get all migration files
    const migrationsDir = __dirname;
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && file !== 'run-migrations.js')
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute the entire migration as one statement
      try {
        await new Promise((resolve, reject) => {
          db.exec(migrationSQL, (err) => {
            if (err) {
              // Ignore "already exists" errors for idempotency
              if (err.message.includes('already exists') || 
                  err.message.includes('duplicate column name')) {
                console.log(`  Skipping: ${err.message}`);
                resolve();
              } else {
                reject(err);
              }
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`  Error in migration: ${file}`);
        throw error;
      }
      
      console.log(`  ✓ Completed migration: ${file}`);
    }
    
    console.log('All migrations completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };