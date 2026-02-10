const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        try {
          // Run migrations
          await runMigrations();
          console.log('Database migrations completed');
          resolve(db);
        } catch (migrationErr) {
          console.error('Migration error:', migrationErr);
          reject(migrationErr);
        }
      }
    });
  });
};

const runMigrations = () => {
  return new Promise((resolve, reject) => {
    // Enable foreign keys and ensure persistent mode
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) return reject(err);

      db.serialize(() => {
        let migrationCount = 0;
        let completedCount = 0;
        const migrationCheckInterval = setInterval(() => {}, 1000); // Keep process alive

        const checkMigrationComplete = () => {
          completedCount++;
          if (completedCount === migrationCount) {
            clearInterval(migrationCheckInterval);
            // Final checkpoint to ensure all data is written to disk
            db.run('PRAGMA optimize', () => {
              resolve();
            });
          }
        };

        // Track total operations
        migrationCount = 22; // 8 tables + 13 indexes + 1 pragma + checkpoint

        // Tenants table
        db.run(`
          CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            address TEXT,
            contact_phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });

        // Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            tenant_id TEXT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT DEFAULT 'restaurant_admin',
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            CHECK (role IN ('superadmin', 'restaurant_admin', 'kitchen_staff', 'cashier'))
          )
        `, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });

        // Restaurant tables
        db.run(`
          CREATE TABLE IF NOT EXISTS restaurant_tables (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            identifier TEXT NOT NULL,
            qr_url TEXT,
            is_active INTEGER DEFAULT 1,
            current_status TEXT DEFAULT 'available',
            active_orders_count INTEGER DEFAULT 0,
            last_order_time DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            UNIQUE (tenant_id, identifier)
          )
        `, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });

        // Menu categories
        db.run(`
          CREATE TABLE IF NOT EXISTS menu_categories (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });

        // Menu items
        db.run(`
          CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            is_available INTEGER DEFAULT 1,
            is_veg INTEGER DEFAULT 1,
            is_spicy INTEGER DEFAULT 0,
            tags TEXT DEFAULT '',
            preparation_time INTEGER,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });

        // Orders
        db.run(`
          CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            table_id TEXT,
            source_type TEXT NOT NULL,
            source_reference TEXT,
            status TEXT DEFAULT 'pending',
            payment_status TEXT DEFAULT 'pending',
            payment_provider TEXT,
            payment_order_id TEXT,
            payment_id TEXT,
            total_amount REAL,
            tax_amount REAL DEFAULT 0,
            discount_amount REAL DEFAULT 0,
            notes TEXT,
            status_changed_at DATETIME,
            aging_level TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
            CHECK (status IN ('pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled')),
            CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'))
          )
        `, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });

        // Order items
        db.run(`
          CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            menu_item_id TEXT,
            name_snapshot TEXT NOT NULL,
            price_snapshot REAL NOT NULL,
            quantity INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'completed', 'cancelled')),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
          )
        `, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });

        // Payment providers
        db.run(`
          CREATE TABLE IF NOT EXISTS payment_providers (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            key_id TEXT NOT NULL,
            key_secret TEXT NOT NULL,
            webhook_secret TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            UNIQUE (tenant_id, provider)
          )
        `, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });

        // Create indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_tables_tenant_id ON restaurant_tables(tenant_id)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON menu_categories(tenant_id)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_items_tenant_id ON menu_items(tenant_id)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_items_category_id ON menu_items(category_id)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_payment_tenant_id ON payment_providers(tenant_id)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_payment_provider ON payment_providers(provider)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
        db.run(`CREATE INDEX IF NOT EXISTS idx_integrations_tenant_id ON integrations(tenant_id)`, (err) => {
          if (err) reject(err);
          checkMigrationComplete();
        });
      });
    });
  });
};

// Promisified database methods
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
};

module.exports = {
  initializeDatabase,
  dbRun,
  dbGet,
  dbAll,
  closeDatabase,
  getDb: () => db
};
