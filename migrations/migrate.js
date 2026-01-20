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

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

db.serialize(() => {
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
  `);

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('superadmin', 'restaurant_admin', 'kitchen_staff', 'cashier')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )
  `);

  // Payment Provider Configuration table
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_providers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL CHECK(provider IN ('razorpay')),
      key_id TEXT NOT NULL,
      key_secret TEXT NOT NULL,
      webhook_secret TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )
  `);

  // Restaurant Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      identifier TEXT NOT NULL,
      qr_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, identifier),
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )
  `);

  // Menu Categories
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )
  `);

  // Menu Items
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      is_available INTEGER DEFAULT 1,
      is_veg INTEGER DEFAULT 1,
      is_spicy INTEGER DEFAULT 0,
      tags TEXT DEFAULT '',
      preparation_time INTEGER,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY(category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
    )
  `);

  // Orders
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      table_id TEXT,
      source_type TEXT NOT NULL CHECK(source_type IN ('table', 'zomato', 'swiggy')),
      source_reference TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cooking', 'ready', 'served', 'completed', 'cancelled')),
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'failed')),
      payment_provider TEXT CHECK(payment_provider IN ('razorpay', 'cash', NULL)),
      payment_order_id TEXT,
      payment_id TEXT,
      total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(10, 2) DEFAULT 0,
      discount_amount DECIMAL(10, 2) DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY(table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL
    )
  `);

  // Order Items
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      name_snapshot TEXT NOT NULL,
      price_snapshot DECIMAL(10, 2) NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'completed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
    )
  `);

  // Add status column migration for existing databases
  db.run(`
    PRAGMA table_info(order_items)
  `, (err, rows) => {
    if (rows) {
      const hasStatusColumn = rows.some((col) => col.name === 'status');
      if (!hasStatusColumn) {
        db.run(`
          ALTER TABLE order_items ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'completed', 'cancelled'))
        `);
      }
    }
  });

  // Add missing columns to menu_items if they don't exist
  db.run(`
    PRAGMA table_info(menu_items)
  `, (err, rows) => {
    if (rows) {
      const columnNames = rows.map((col) => col.name);
      
      if (!columnNames.includes('is_veg')) {
        db.run(`ALTER TABLE menu_items ADD COLUMN is_veg INTEGER DEFAULT 1`);
      }
      if (!columnNames.includes('is_spicy')) {
        db.run(`ALTER TABLE menu_items ADD COLUMN is_spicy INTEGER DEFAULT 0`);
      }
      if (!columnNames.includes('tags')) {
        db.run(`ALTER TABLE menu_items ADD COLUMN tags TEXT DEFAULT ''`);
      }
      if (!columnNames.includes('preparation_time')) {
        db.run(`ALTER TABLE menu_items ADD COLUMN preparation_time INTEGER`);
      }
    }
  });

  // Create indexes for better query performance
  db.run('CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  db.run('CREATE INDEX IF NOT EXISTS idx_restaurant_tables_tenant_id ON restaurant_tables(tenant_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_menu_categories_tenant_id ON menu_categories(tenant_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_id ON menu_items(tenant_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_source_type ON orders(source_type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_payment_providers_tenant_id ON payment_providers(tenant_id)');

  // Add missing columns to existing menu_items table
  db.all("PRAGMA table_info(menu_items)", (err, columns) => {
    if (err) {
      console.error('Error checking menu_items table columns:', err);
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    const columnsToAdd = [
      { name: 'is_veg', sql: 'ALTER TABLE menu_items ADD COLUMN is_veg INTEGER DEFAULT 1' },
      { name: 'is_spicy', sql: 'ALTER TABLE menu_items ADD COLUMN is_spicy INTEGER DEFAULT 0' },
      { name: 'tags', sql: "ALTER TABLE menu_items ADD COLUMN tags TEXT DEFAULT ''" },
      { name: 'preparation_time', sql: 'ALTER TABLE menu_items ADD COLUMN preparation_time INTEGER' }
    ];

    columnsToAdd.forEach(col => {
      if (!columnNames.includes(col.name)) {
        db.run(col.sql, (err) => {
          if (err) {
            console.warn(`Could not add column ${col.name}:`, err.message);
          } else {
            console.log(`✓ Added column ${col.name} to menu_items table`);
          }
        });
      }
    });
  });

  console.log('Database schema created successfully');
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
    process.exit(1);
  }
});
