require('dotenv').config();
const { initializeDatabase } = require('./database-postgres');
const TenantRepository = require('./repositories/TenantRepository');
const RestaurantTableRepository = require('./repositories/RestaurantTableRepository');
const MenuItemRepository = require('./repositories/MenuItemRepository');
const OrderRepository = require('./repositories/OrderRepository');
const OrderItemRepository = require('./repositories/OrderItemRepository');

async function debugOrderCreation() {
  try {
    console.log('🔍 Starting Order Creation Debug...');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Test 1: Find restaurant
    console.log('\n📍 Testing restaurant lookup...');
    const tenant = await TenantRepository.findBySlug('the-shubham-cafe');
    if (!tenant) {
      console.log('❌ Restaurant not found');
      return;
    }
    console.log('✅ Restaurant found:', tenant.name);

    // Test 2: Find table
    console.log('\n🪑 Testing table lookup...');
    const table = await RestaurantTableRepository.findByIdentifier(tenant.id, 'table-1');
    if (!table) {
      console.log('❌ Table not found');
      return;
    }
    console.log('✅ Table found:', table.name);

    // Test 3: Find menu items
    console.log('\n🍽️ Testing menu items...');
    const menuItems = await MenuItemRepository.findByTenant(tenant.id);
    console.log(`✅ Found ${menuItems.length} menu items`);
    
    if (menuItems.length === 0) {
      console.log('❌ No menu items available');
      return;
    }

    // Test 4: Create test order
    console.log('\n📝 Testing order creation...');
    const testOrderData = {
      tenant_id: tenant.id,
      table_id: table.id,
      source_type: 'table',
      source_reference: 'table-1',
      status: 'draft',
      payment_status: 'pending',
      payment_provider: 'paytm',
      total_amount: 100.00,
      notes: 'Test order'
    };

    const orderId = await OrderRepository.create(testOrderData);
    console.log('✅ Order created successfully:', orderId);

    // Test 5: Create test order item
    console.log('\n🍕 Testing order item creation...');
    const testItemData = {
      order_id: orderId,
      menu_item_id: menuItems[0].id,
      name_snapshot: menuItems[0].name,
      price_snapshot: menuItems[0].price,
      quantity: 1
    };

    const itemId = await OrderItemRepository.create(testItemData);
    console.log('✅ Order item created successfully:', itemId);

    // Test 6: Retrieve created order
    console.log('\n📋 Testing order retrieval...');
    const createdOrder = await OrderRepository.findById(orderId);
    console.log('✅ Order retrieved:', createdOrder.id);

    const orderItems = await OrderItemRepository.findByOrder(orderId);
    console.log('✅ Order items retrieved:', orderItems.length);

    console.log('\n🎉 All tests passed! Order creation should work.');

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

debugOrderCreation();