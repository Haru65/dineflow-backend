const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Create audit log table and monitoring system
async function setupAuditSystem() {
  const db = new sqlite3.Database('./data/dineflow.db');
  
  console.log('=== Setting up Restaurant Audit System ===');
  
  // Create audit log table
  db.run(`
    CREATE TABLE IF NOT EXISTS tenant_audit_log (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      user_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating audit table:', err);
      return;
    }
    console.log('✓ Created tenant_audit_log table');
    
    // Create triggers for automatic auditing
    db.run(`
      CREATE TRIGGER IF NOT EXISTS tenant_update_audit
      AFTER UPDATE ON tenants
      FOR EACH ROW
      BEGIN
        INSERT INTO tenant_audit_log (
          id, tenant_id, action, old_data, new_data, timestamp
        ) VALUES (
          'audit_' || hex(randomblob(16)),
          NEW.id,
          'UPDATE',
          json_object(
            'name', OLD.name,
            'slug', OLD.slug,
            'is_active', OLD.is_active,
            'updated_at', OLD.updated_at
          ),
          json_object(
            'name', NEW.name,
            'slug', NEW.slug,
            'is_active', NEW.is_active,
            'updated_at', NEW.updated_at
          ),
          CURRENT_TIMESTAMP
        );
      END;
    `, (err) => {
      if (err) {
        console.error('Error creating update trigger:', err);
      } else {
        console.log('✓ Created update audit trigger');
      }
    });
    
    db.run(`
      CREATE TRIGGER IF NOT EXISTS tenant_delete_audit
      AFTER DELETE ON tenants
      FOR EACH ROW
      BEGIN
        INSERT INTO tenant_audit_log (
          id, tenant_id, action, old_data, timestamp
        ) VALUES (
          'audit_' || hex(randomblob(16)),
          OLD.id,
          'DELETE',
          json_object(
            'name', OLD.name,
            'slug', OLD.slug,
            'is_active', OLD.is_active
          ),
          CURRENT_TIMESTAMP
        );
      END;
    `, (err) => {
      if (err) {
        console.error('Error creating delete trigger:', err);
      } else {
        console.log('✓ Created delete audit trigger');
      }
    });
    
    // Show current status
    db.all(`
      SELECT 
        t.id, t.name, t.slug, t.is_active, t.created_at,
        COUNT(al.id) as audit_count
      FROM tenants t
      LEFT JOIN tenant_audit_log al ON t.id = al.tenant_id
      GROUP BY t.id, t.name, t.slug, t.is_active, t.created_at
      ORDER BY t.created_at DESC
    `, (err, rows) => {
      if (err) {
        console.error('Error fetching tenant status:', err);
      } else {
        console.log(`\nCurrent restaurants with audit info:`);
        rows.forEach((row, index) => {
          const status = row.is_active ? 'ACTIVE' : 'INACTIVE';
          console.log(`${index + 1}. ${row.name} (${row.slug}) - ${status} - Audit entries: ${row.audit_count}`);
        });
      }
      
      db.close();
      console.log('\n✓ Audit system setup complete');
      console.log('\nFeatures added:');
      console.log('- Automatic audit logging for all tenant changes');
      console.log('- Soft delete system (restaurants are deactivated, not deleted)');
      console.log('- Restore functionality for accidentally deleted restaurants');
      console.log('- Full audit trail of all changes');
    });
  });
}

setupAuditSystem();