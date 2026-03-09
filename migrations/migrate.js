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

let db;
let migrationQueue = [];
let isProcessing = false;

const db_open = new Promise((resolve, reject) => {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err);
      reject(err);
    } else {
      console.log('Connected to SQLite database');
      resolve(db);
    }
  });
});

// Queue and process migrations sequentially
function queueMigration(sql, description) {
  migrationQueue.push({ sql, description });
}

function processMigrationQueue() {
  if (isProcessing || migrationQueue.length === 0) return;
  
  isProcessing = true;
  const { sql, description } = migrationQueue.shift();
  
  db.exec(sql, (err) => {
    if (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate column name')) {
        console.log(`  ⚠ Skipped: ${description} (${err.message})`);
      } else {
        console.error(`  ✗ Failed: ${description}`);
        console.error(`    Error: ${err.message}`);
      }
    } else {
      console.log(`  ✓ ${description}`);
    }
    
    isProcessing = false;
    processMigrationQueue();
  });
}

// Initialize database and run migrations
async function runAllMigrations() {
  try {
    await db_open;
    
    console.log('\n📋 Running base schema migrations...');
    
    // Base schema migrations
    queueMigration(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        address TEXT,
        contact_phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, 'Create tenants table');

    queueMigration(`
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
    `, 'Create users table');

    queueMigration(`
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
    `, 'Create payment_providers table');

    queueMigration(`
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
    `, 'Create restaurant_tables table');

    queueMigration(`
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
    `, 'Create menu_categories table');

    queueMigration(`
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
    `, 'Create menu_items table');

    queueMigration(`
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
    `, 'Create orders table');

    queueMigration(`
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
    `, 'Create order_items table');

    queueMigration('CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)', 'Create index: users.tenant_id');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)', 'Create index: users.email');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_restaurant_tables_tenant_id ON restaurant_tables(tenant_id)', 'Create index: restaurant_tables.tenant_id');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_menu_categories_tenant_id ON menu_categories(tenant_id)', 'Create index: menu_categories.tenant_id');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_id ON menu_items(tenant_id)', 'Create index: menu_items.tenant_id');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id)', 'Create index: menu_items.category_id');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id)', 'Create index: orders.tenant_id');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id)', 'Create index: orders.table_id');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_orders_source_type ON orders(source_type)', 'Create index: orders.source_type');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)', 'Create index: orders.payment_status');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)', 'Create index: orders.status');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)', 'Create index: order_items.order_id');
    queueMigration('CREATE INDEX IF NOT EXISTS idx_payment_providers_tenant_id ON payment_providers(tenant_id)', 'Create index: payment_providers.tenant_id');

    // Load and queue SQL migration files
    console.log('\n📁 Running SQL migration files...');
    const migrationsDir = __dirname;
    const sqlFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      queueMigration(sql, `Execute ${file}`);
    }

    // Start processing migrations
    processMigrationQueue();

    // Wait for all migrations to complete
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (migrationQueue.length === 0 && !isProcessing) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });

    console.log('\n✅ All migrations completed successfully!');
    
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runAllMigrations();
