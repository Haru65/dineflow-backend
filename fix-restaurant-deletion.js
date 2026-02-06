const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Fix restaurant deletion by implementing soft delete
async function fixRestaurantDeletion() {
  const db = new sqlite3.Database('./data/dineflow.db');
  
  console.log('=== Fixing Restaurant Deletion System ===');
  
  // Step 1: Add is_active column to tenants table if it doesn't exist
  db.run(`ALTER TABLE tenants ADD COLUMN is_active INTEGER DEFAULT 1`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding is_active column:', err);
      return;
    }
    console.log('✓ Added is_active column to tenants table');
    
    // Step 2: Update all existing tenants to be active
    db.run(`UPDATE tenants SET is_active = 1 WHERE is_active IS NULL`, (err) => {
      if (err) {
        console.error('Error updating existing tenants:', err);
        return;
      }
      console.log('✓ Updated existing tenants to active status');
      
      // Step 3: Show current status
      db.all('SELECT id, name, slug, is_active, created_at FROM tenants ORDER BY created_at', (err, rows) => {
        if (err) {
          console.error('Error fetching tenants:', err);
        } else {
          console.log(`\nCurrent restaurants (${rows.length}):`);
          rows.forEach((row, index) => {
            const status = row.is_active ? 'ACTIVE' : 'INACTIVE';
            console.log(`${index + 1}. ${row.name} (${row.slug}) - ${status} - Created: ${row.created_at}`);
          });
        }
        
        db.close();
        console.log('\n✓ Database updated successfully');
        console.log('\nNext steps:');
        console.log('1. Update TenantRepository.js to use soft delete');
        console.log('2. Update superadmin routes to use soft delete');
        console.log('3. Update all queries to filter by is_active = 1');
      });
    });
  });
}

fixRestaurantDeletion();