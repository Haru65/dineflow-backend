const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new sqlite3.Database(dbPath);

console.log('Searching for Indian Masala restaurant...\n');

db.all(`SELECT id, name, slug FROM tenants WHERE LOWER(name) LIKE '%indian%masala%' OR LOWER(slug) LIKE '%indian%masala%'`, (err, tenants) => {
  if (err) {
    console.error('Error:', err);
  } else {
    if (tenants.length > 0) {
      console.log('Found Indian Masala restaurant(s):');
      tenants.forEach(tenant => {
        console.log(`  - ${tenant.name} (${tenant.slug})`);
        console.log(`    ID: ${tenant.id}\n`);
        
        // Get admin users for this tenant
        db.all(`SELECT id, email, name, role FROM users WHERE tenant_id = ?`, [tenant.id], (err, users) => {
          if (err) {
            console.error('Error:', err);
          } else {
            console.log(`    Admin users:`);
            users.forEach(user => {
              console.log(`      - ${user.email} (${user.name})`);
            });
            console.log('');
          }
          db.close();
        });
      });
    } else {
      console.log('Indian Masala restaurant not found in database.');
      db.close();
    }
  }
});
