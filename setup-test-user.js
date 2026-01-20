require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { generateId } = require('./utils/helpers');
const { hashPassword } = require('./utils/auth');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new sqlite3.Database(dbPath);

const DEFAULT_CATEGORIES = [
  { name: 'Starters', sort_order: 0 },
  { name: 'Main Course', sort_order: 1 },
  { name: 'Desserts', sort_order: 2 },
  { name: 'Drinks', sort_order: 3 }
];

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function createDefaultCategories(tenantId) {
  try {
    console.log('\nCreating default menu categories...');
    for (const category of DEFAULT_CATEGORIES) {
      const categoryId = generateId();
      await run(
        `INSERT INTO menu_categories (id, tenant_id, name, sort_order) 
         VALUES (?, ?, ?, ?)`,
        [categoryId, tenantId, category.name, category.sort_order]
      );
      console.log(`   ✓ ${category.name}`);
    }
  } catch (error) {
    console.error('⚠️  Error creating categories (they may already exist):', error.message);
  }
}

async function createTestRestaurant() {
  try {
    console.log('Setting up test restaurant and admin...');

    // Check if test restaurant exists
    let restaurant = await get('SELECT id FROM tenants WHERE name = ?', ['Test Restaurant']);
    
    if (!restaurant) {
      const restaurantId = generateId();
      await run(
        `INSERT INTO tenants (id, name, slug, address, contact_phone) 
         VALUES (?, ?, ?, ?, ?)`,
        [restaurantId, 'Test Restaurant', 'test-restaurant', '123 Test St', '555-1234']
      );
      restaurant = { id: restaurantId };
      console.log('✅ Created test restaurant:', restaurantId);
      
      // Create default categories for new restaurant
      await createDefaultCategories(restaurantId);
    } else {
      console.log('✅ Test restaurant already exists:', restaurant.id);
    }

    // Check if test admin exists
    let admin = await get('SELECT id FROM users WHERE email = ?', ['restaurant@dineflow.com']);
    
    if (!admin) {
      const passwordHash = await hashPassword('Demo@123');
      const userId = generateId();
      await run(
        `INSERT INTO users (id, tenant_id, email, password_hash, name, role) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, restaurant.id, 'restaurant@dineflow.com', passwordHash, 'Restaurant Admin', 'restaurant_admin']
      );
      console.log('✅ Created test restaurant admin');
      console.log(`   Email: restaurant@dineflow.com`);
      console.log(`   Password: Demo@123`);
      console.log(`   Restaurant ID: ${restaurant.id}`);
    } else {
      console.log('✅ Test restaurant admin already exists');
    }

    db.close();
    console.log('\n✅ Setup complete! You can now log in with:');
    console.log('   Email: restaurant@dineflow.com');
    console.log('   Password: Demo@123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestRestaurant();
