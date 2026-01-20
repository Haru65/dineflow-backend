const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new sqlite3.Database(dbPath);

console.log('Checking restaurant tables and QR URLs...\n');

db.all(`
  SELECT 
    t.id, 
    t.name, 
    t.identifier, 
    t.qr_url,
    te.name as restaurant_name,
    te.slug as restaurant_slug
  FROM restaurant_tables t
  JOIN tenants te ON t.tenant_id = te.id
  ORDER BY te.name, t.name
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Restaurant Tables:');
    rows.forEach(table => {
      console.log(`\n  Restaurant: ${table.restaurant_name} (${table.restaurant_slug})`);
      console.log(`  Table: ${table.name}`);
      console.log(`  Identifier: ${table.identifier}`);
      console.log(`  QR URL: ${table.qr_url}`);
    });
  }
  
  db.close();
});
