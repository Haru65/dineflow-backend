const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new sqlite3.Database(dbPath);

console.log('Checking for Indian Masala Restaurant...\n');

db.all(`
  SELECT 
    t.id, 
    t.name, 
    t.slug,
    COUNT(rt.id) as table_count
  FROM tenants t
  LEFT JOIN restaurant_tables rt ON t.id = rt.tenant_id
  WHERE LOWER(t.slug) LIKE '%indian%' OR LOWER(t.name) LIKE '%indian%'
  GROUP BY t.id
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    if (rows.length === 0) {
      console.log('❌ Indian Masala Restaurant NOT FOUND in database');
      console.log('\nYou need to create the restaurant first in the admin panel.');
    } else {
      console.log('✓ Found Indian Masala Restaurant:');
      rows.forEach(r => {
        console.log(`\n  Restaurant: ${r.name}`);
        console.log(`  Slug: ${r.slug}`);
        console.log(`  ID: ${r.id}`);
        console.log(`  Tables: ${r.table_count}`);
        
        // Get tables for this restaurant
        db.all(`
          SELECT id, name, identifier, qr_url 
          FROM restaurant_tables 
          WHERE tenant_id = ?
        `, [r.id], (err, tables) => {
          if (tables && tables.length > 0) {
            console.log(`\n  Tables:`);
            tables.forEach(t => {
              console.log(`    - ${t.name} (identifier: ${t.identifier})`);
              console.log(`      QR URL: ${t.qr_url}`);
            });
          } else {
            console.log(`\n  ⚠️  No tables created yet`);
          }
        });
      });
    }
  }
  
  setTimeout(() => db.close(), 1000);
});
