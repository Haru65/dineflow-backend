const sqlite3 = require('sqlite3').verbose();
const { generateId } = require('./utils/helpers');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/dineflow.db';
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

async function seedData() {
  try {
    console.log('Starting to seed data...');

    // Get the existing tenant
    const tenants = await new Promise((resolve, reject) => {
      db.all('SELECT id FROM tenants LIMIT 1', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (!tenants || tenants.length === 0) {
      console.log('No tenant found, creating one...');
      return;
    }

    const tenantId = tenants[0].id;
    console.log('Using tenant:', tenantId);

    // Get existing menu categories or create if none exist
    const categories = await new Promise((resolve, reject) => {
      db.all('SELECT id, name FROM menu_categories WHERE tenant_id = ? LIMIT 2', [tenantId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    let categoryId1, categoryId2;
    if (categories.length >= 2) {
      categoryId1 = categories[0].id;
      categoryId2 = categories[1].id;
    } else {
      categoryId1 = generateId();
      await run(
        `INSERT INTO menu_categories (id, tenant_id, name, sort_order) 
         VALUES (?, ?, ?, ?)`,
        [categoryId1, tenantId, 'Main Course', 1]
      );

      categoryId2 = generateId();
      await run(
        `INSERT INTO menu_categories (id, tenant_id, name, sort_order) 
         VALUES (?, ?, ?, ?)`,
        [categoryId2, tenantId, 'Appetizers', 2]
      );
    }

    // Get existing menu items or create sample ones
    const menuItems = await new Promise((resolve, reject) => {
      db.all('SELECT id, name, price FROM menu_items WHERE tenant_id = ? LIMIT 4', [tenantId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    let items;
    let itemIds = [];
    
    if (menuItems.length >= 4) {
      items = menuItems;
      itemIds = menuItems.map(i => i.id);
    } else {
      items = [
        { name: 'Butter Chicken', category: categoryId1, price: 350 },
        { name: 'Garlic Naan', category: categoryId1, price: 80 },
        { name: 'Paneer Tikka', category: categoryId2, price: 280 },
        { name: 'Samosa', category: categoryId2, price: 40 },
      ];

      for (const item of items) {
        const itemId = generateId();
        itemIds.push(itemId);
        await run(
          `INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, is_available) 
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [itemId, tenantId, item.category, item.name, `Delicious ${item.name}`, item.price]
        );
      }
    }

    // Get existing table or create one
    const tables = await new Promise((resolve, reject) => {
      db.all('SELECT id FROM restaurant_tables WHERE tenant_id = ? LIMIT 1', [tenantId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    let tableId;
    if (tables.length > 0) {
      tableId = tables[0].id;
    } else {
      tableId = generateId();
      await run(
        `INSERT INTO restaurant_tables (id, tenant_id, name, identifier) 
         VALUES (?, ?, ?, ?)`,
        [tableId, tenantId, 'Table 1', 'T001']
      );
    }

    // Create test orders
    for (let i = 0; i < 3; i++) {
      const orderId = generateId();
      const statuses = ['pending', 'confirmed', 'cooking', 'ready'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      await run(
        `INSERT INTO orders (id, tenant_id, table_id, source_type, source_reference, status, payment_status, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, tenantId, tableId, 'table', 'T001', status, 'pending', 500]
      );

      // Add items to order
      for (let j = 0; j < 2; j++) {
        const itemIndex = Math.floor(Math.random() * itemIds.length);
        const itemId = itemIds[itemIndex];
        const orderItemId = generateId();
        const itemStatus = status === 'cooking' || status === 'pending' ? 'pending' : 'ready';

        await run(
          `INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, price_snapshot, quantity, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderItemId, orderId, itemId, items[itemIndex].name, items[itemIndex].price, 1, itemStatus]
        );
      }
    }

    console.log('✅ Data seeded successfully!');
    console.log(`Created 3 test orders with items`);
    db.close();
  } catch (error) {
    console.error('Error seeding data:', error);
    db.close();
    process.exit(1);
  }
}

seedData();
