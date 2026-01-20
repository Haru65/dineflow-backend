const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new sqlite3.Database(dbPath);

console.log('Checking tenants and users...\n');

// Get all tenants
db.all('SELECT id, name, slug FROM tenants', (err, tenants) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tenants in database:');
    tenants.forEach(tenant => {
      console.log(`  - ${tenant.name} (${tenant.slug})`);
      console.log(`    ID: ${tenant.id}\n`);
    });
  }
  
  // Get users for each tenant
  db.all(`SELECT id, email, name, role, tenant_id FROM users WHERE role = 'restaurant_admin'`, (err, users) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('\nRestaurant Admin Users:');
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.name})`);
        console.log(`    Tenant ID: ${user.tenant_id}\n`);
      });
    }
    
    db.close();
  });
});
