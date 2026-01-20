#!/usr/bin/env node

/**
 * Quick Fix: Add Default Categories to Test Restaurant
 * Run this when you can't add menu items due to missing categories
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const { generateId } = require('./utils/helpers');

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new Database(dbPath);

const DEFAULT_CATEGORIES = [
  { name: 'Starters', sort_order: 0 },
  { name: 'Main Course', sort_order: 1 },
  { name: 'Desserts', sort_order: 2 },
  { name: 'Drinks', sort_order: 3 }
];

async function fixMissingCategories() {
  try {
    console.log('🔧 Starting category fix...\n');
    
    // Get all tenants
    const tenants = db.prepare('SELECT id, name FROM tenants').all();
    
    if (tenants.length === 0) {
      console.log('❌ No tenants found in database.');
      process.exit(1);
    }
    
    console.log(`Found ${tenants.length} tenant(s):\n`);
    
    for (const tenant of tenants) {
      const existingCategories = db.prepare(
        'SELECT COUNT(*) as count FROM menu_categories WHERE tenant_id = ?'
      ).get(tenant.id);
      
      console.log(`  🏢 ${tenant.name}`);
      console.log(`     ID: ${tenant.id}`);
      console.log(`     Categories: ${existingCategories.count}`);
      
      if (existingCategories.count === 0) {
        console.log(`     ⏳ Adding default categories...`);
        try {
          for (const category of DEFAULT_CATEGORIES) {
            const categoryId = generateId();
            db.prepare(
              `INSERT INTO menu_categories (id, tenant_id, name, sort_order) 
               VALUES (?, ?, ?, ?)`
            ).run(categoryId, tenant.id, category.name, category.sort_order);
          }
          console.log(`     ✅ Added 4 default categories\n`);
        } catch (err) {
          console.log(`     ❌ Error: ${err.message}\n`);
        }
      } else {
        console.log(`     ✓ Already has categories\n`);
      }
    }
    
    console.log('✅ Category fix complete!');
    console.log('\n📝 You can now:');
    console.log('   1. Go to Admin Dashboard');
    console.log('   2. Open Menu Management');
    console.log('   3. Click "Add Item" to add menu items');
    console.log('   4. Categories will appear in the dropdown');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixMissingCategories();
