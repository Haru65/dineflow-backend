const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initializeDatabase = async () => {
  try {
    console.log('Connecting to PostgreSQL database...');
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Run migrations
    await runMigrations(client);
    console.log('Database migrations completed');
    
    client.release();
    return pool;
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
};

const runMigrations = async (client) => {
  const migrations = [
    // Tenants table
    `CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      address TEXT,
      contact_phone TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'restaurant_admin' CHECK(role IN ('superadmin', 'restaurant_admin', 'kitchen_staff', 'cashier')),
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )`,
    
    // Restaurant tables
    `CREATE TABLE IF NOT EXISTS restaurant_tables (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      identifier TEXT NOT NULL,
      qr_url TEXT,
      table_type TEXT DEFAULT 'regular',
      is_active INTEGER DEFAULT 1,
      current_status TEXT DEFAULT 'available',
      active_orders_count INTEGER DEFAULT 0,
      last_order_time TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE (tenant_id, identifier)
    )`,
    
    // Menu categories
    `CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )`,
    
    // Menu items
    `CREATE TABLE IF NOT EXISTS menu_items (
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
    )`,
    
    // Orders
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      table_id TEXT,
      source_type TEXT NOT NULL,
      source_reference TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled')),
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'completed', 'failed', 'refunded')),
      payment_provider TEXT,
      payment_order_id TEXT,
      payment_id TEXT,
      total_amount DECIMAL(10, 2),
      tax_amount DECIMAL(10, 2) DEFAULT 0,
      discount_amount DECIMAL(10, 2) DEFAULT 0,
      notes TEXT,
      status_changed_at TIMESTAMP,
      aging_level TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL
    )`,
    
    // Order items
    `CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT,
      name_snapshot TEXT NOT NULL,
      price_snapshot DECIMAL(10, 2) NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'completed', 'cancelled')),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
    )`,
    
    // Payment providers
    `CREATE TABLE IF NOT EXISTS payment_providers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      key_id TEXT NOT NULL,
      key_secret TEXT NOT NULL,
      webhook_secret TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE (tenant_id, provider)
    )`,
    
    // Integrations
    `CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      service_type TEXT NOT NULL,
      config TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )`,
    
    // Offers table
    `CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      discount_percentage DECIMAL(5, 2),
      discount_amount DECIMAL(10, 2),
      valid_from TIMESTAMP,
      valid_until TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )`,
    
    // Quick actions table
    `CREATE TABLE IF NOT EXISTS quick_actions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      action_type TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )`,
    
    // Receptionist QR table
    `CREATE TABLE IF NOT EXISTS receptionist_qr (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      qr_code TEXT NOT NULL,
      qr_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    `CREATE INDEX IF NOT EXISTS idx_integrations_tenant_id ON integrations(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_offers_tenant_id ON offers(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_quick_actions_tenant_id ON quick_actions(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_receptionist_qr_tenant_id ON receptionist_qr(tenant_id)`
  ];

  for (const migration of migrations) {
    try {
      await client.query(migration);
    } catch (err) {
      // Ignore "already exists" errors
      if (!err.message.includes('already exists')) {
        console.error('Migration error:', err.message);
      }
    }
  }
};

// Promisified database methods
const dbRun = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return { id: result.rows[0]?.id, changes: result.rowCount };
  } catch (err) {
    console.error('Query error:', err);
    throw err;
  }
};

const dbGet = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows[0];
  } catch (err) {
    console.error('Query error:', err);
    throw err;
  }
};

const dbAll = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows || [];
  } catch (err) {
    console.error('Query error:', err);
    throw err;
  }
};

const closeDatabase = async () => {
  try {
    await pool.end();
  } catch (err) {
    console.error('Error closing database:', err);
  }
};

module.exports = {
  initializeDatabase,
  dbRun,
  dbGet,
  dbAll,
  closeDatabase,
  getDb: () => pool
};
