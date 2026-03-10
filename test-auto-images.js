const { initializeDatabase } = require('./database-postgres');
const MenuItemRepository = require('./repositories/MenuItemRepository');
const imageService = require('./utils/imageService');

async function testAutoImageIntegration() {
  try {
    console.log('🧪 Testing Auto Image Integration...\n');
    
    await initializeDatabase();
    
    // Test 1: Test image service directly
    console.log('1. Testing Image Service:');
    const testDishes = ['Chicken Biryani', 'Margherita Pizza', 'Chocolate Cake'];
    
    for (const dish of testDishes) {
      const imageUrl = await imageService.autoFetchImageForMenuItem(dish);
      console.log(`   ${dish}: ${imageUrl ? '✅' : '❌'} ${imageUrl || 'No image'}`);
    }
    
    console.log('\n2. Testing Menu Item Creation with Auto Images:');
    
    // Test 2: Create a test menu item (you'll need to provide a valid tenant_id and category_id)
    const testTenantId = 'test-tenant-123'; // Replace with actual tenant ID
    const testCategoryId = 'test-category-123'; // Replace with actual category ID
    
    console.log('   Note: To test menu item creation, update testTenantId and testCategoryId in this script');
    console.log(`   Current testTenantId: ${testTenantId}`);
    console.log(`   Current testCategoryId: ${testCategoryId}`);
    
    // Uncomment below to test actual menu item creation
    /*
    const testItem = {
      tenant_id: testTenantId,
      category_id: testCategoryId,
      name: 'Test Butter Chicken',
      description: 'Delicious test dish',
      price: 299.99
    };
    
    console.log('   Creating test menu item...');
    const itemId = await MenuItemRepository.create(testItem);
    console.log(`   ✅ Created item with ID: ${itemId}`);
    
    // Check if image was auto-assigned
    const createdItem = await MenuItemRepository.findById(itemId);
    console.log(`   Image URL: ${createdItem.image_url || 'No image assigned'}`);
    */
    
    console.log('\n✅ Auto Image Integration Test Complete!');
    console.log('\nTo fully test:');
    console.log('1. Update testTenantId and testCategoryId in this script');
    console.log('2. Uncomment the menu item creation test');
    console.log('3. Run: node test-auto-images.js');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  testAutoImageIntegration();
}