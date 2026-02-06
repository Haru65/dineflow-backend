const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new sqlite3.Database(dbPath);

const { generateQRUrl } = require('./utils/helpers');

console.log('Fixing QR URLs for all tables...\n');

// Get all tables with their restaurant slugs
db.all(`
  SELECT 
    t.id, 
    t.name, 
    t.identifier, 
    t.qr_url,
    te.slug as restaurant_slug
  FROM restaurant_tables t
  JOIN tenants te ON t.tenant_id = te.id
  ORDER BY te.name, t.name
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  console.log(`Found ${rows.length} tables. Updating QR URLs...\n`);

  let updated = 0;
  let errors = 0;

  rows.forEach(table => {
    // Generate correct QR URL
    const correctQrUrl = generateQRUrl(table.restaurant_slug, table.identifier);
    
    // Update the table
    db.run('UPDATE restaurant_tables SET qr_url = ? WHERE id = ?', [correctQrUrl, table.id], (err) => {
      if (err) {
        console.error(`✗ Error updating table ${table.name} (${table.id}):`, err);
        errors++;
      } else {
        console.log(`✓ Updated ${table.name}: ${correctQrUrl}`);
        updated++;
      }

      // Close connection after last update
      if (updated + errors === rows.length) {
        console.log(`\n✓ Successfully updated ${updated} QR URLs!`);
        if (errors > 0) {
          console.log(`✗ ${errors} errors occurred.`);
        }
        db.close();
      }
    });
  });
});