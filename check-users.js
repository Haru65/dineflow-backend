const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new sqlite3.Database(dbPath);

console.log('Checking users in database...\n');

// Get all users
db.all('SELECT id, email, name, role, password_hash FROM users', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Users in database:');
    rows.forEach(user => {
      console.log(`  - ${user.email} (${user.name}, ${user.role})`);
      console.log(`    ID: ${user.id}`);
      console.log(`    Password hash exists: ${!!user.password_hash}\n`);
    });
  }
  
  db.close();
});
