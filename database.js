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
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) return reject(err);

      db.serialize(() => {
        try {
          let completed = 0;
          const migrations = [
            // Tables
            `CREATE TABLE IF NOT EXISTS tenants (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              slug TEXT UNIQUE NOT NULL,
              address TEXT,
              contact_phone TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS users (
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
            )`,
            `CREATE TABLE IF NOT EXISTS restaurant_tables (
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
            )`,
            `CREATE TABLE IF NOT EXISTS menu_categories (
              id TEXT PRIMARY KEY,
              tenant_id TEXT NOT NULL,
              name TEXT NOT NULL,
              sort_order INTEGER DEFAULT 0,
              is_active INTEGER DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS menu_items (
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
            )`,
            `CREATE TABLE IF NOT EXISTS orders (
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
            )`,
            `CREATE TABLE IF NOT EXISTS order_items (
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
            )`,
            `CREATE TABLE IF NOT EXISTS payment_providers (
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
            )`,
            `CREATE TABLE IF NOT EXISTS integrations (
              id TEXT PRIMARY KEY,
              tenant_id TEXT NOT NULL,
              service_type TEXT NOT NULL,
              config TEXT,
              is_active INTEGER DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            )`,
            // Indexes
            `CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)`,
            `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
            `CREATE INDEX IF NOT EXISTS idx_tables_tenant_id ON restaurant_tables(tenant_id)`,
            `CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON menu_categories(tenant_id)`,
            `CREATE INDEX IF NOT EXISTS idx_items_tenant_id ON menu_items(tenant_id)`,
            `CREATE INDEX IF NOT EXISTS idx_items_category_id ON menu_items(category_id)`,
            `CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id)`,
            `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
            `CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)`,
            `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`,
            `CREATE INDEX IF NOT EXISTS idx_payment_tenant_id ON payment_providers(tenant_id)`,
            `CREATE INDEX IF NOT EXISTS idx_payment_provider ON payment_providers(provider)`,
            `CREATE INDEX IF NOT EXISTS idx_integrations_tenant_id ON integrations(tenant_id)`
          ];

          const total = migrations.length;
          let errored = false;

          migrations.forEach((migration, index) => {
            db.run(migration, (err) => {
              if (err && !errored) {
                errored = true;
                console.error(`Migration ${index} failed:`, err);
                reject(err);
              } else if (!errored) {
                completed++;
                if (completed % 5 === 0) {
                  console.log(`Migration progress: ${completed}/${total}`);
                }
                if (completed === total) {
                  console.log('All migrations completed successfully');
                  resolve();
                }
              }
            });
          });
        } catch (err) {
          console.error('Error queuing migrations:', err);
          reject(err);
        }
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
