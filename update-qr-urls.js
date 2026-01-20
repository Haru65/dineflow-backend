const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new sqlite3.Database(dbPath);

const oldBaseUrl = 'http://localhost:3000';
const newFrontendUrl = process.env.FRONTEND_URL || 'https://tablescan-order.vercel.app';

console.log(`Updating QR URLs from "${oldBaseUrl}" to "${newFrontendUrl}"\n`);

// Get all tables with old QR URLs
db.all(`SELECT id, qr_url FROM restaurant_tables WHERE qr_url LIKE ?`, [`${oldBaseUrl}%`], (err, rows) => {
  if (err) {
    console.error('Error reading QR URLs:', err);
    db.close();
    return;
  }

  if (rows.length === 0) {
    console.log('No QR URLs to update (all already using correct base URL)');
    db.close();
    return;
  }

  console.log(`Found ${rows.length} tables with old QR URLs. Updating...\n`);

  // Update each QR URL
  let updated = 0;
  rows.forEach(row => {
    const newQrUrl = row.qr_url.replace(oldBaseUrl, newFrontendUrl);
    
    db.run('UPDATE restaurant_tables SET qr_url = ? WHERE id = ?', [newQrUrl, row.id], (err) => {
      if (err) {
        console.error(`Error updating table ${row.id}:`, err);
      } else {
        console.log(`✓ Updated: ${row.qr_url}`);
        console.log(`           → ${newQrUrl}\n`);
        updated++;
      }

      // Close connection after last update
      if (updated === rows.length) {
        console.log(`\n✓ Successfully updated ${updated} QR URLs!`);
        db.close();
      }
    });
  });
});
