const axios = require('axios');

/**
 * Test script to demonstrate image fetching for different dish types
 */

async function testFoodishAPI() {
  console.log('🧪 Testing Foodish API for different dish types...\n');

  const testDishes = [
    { name: 'Chicken Biryani', expectedCategory: 'biryani' },
    { name: 'Margherita Pizza', expectedCategory: 'pizza' },
    { name: 'Chicken Curry', expectedCategory: 'butter-chicken' },
    { name: 'Pasta Carbonara', expectedCategory: 'pasta' },
    { name: 'Beef Burger', expectedCategory: 'burger' },
    { name: 'Chocolate Cake', expectedCategory: 'dessert' },
    { name: 'Fried Rice', expectedCategory: 'rice' },
    { name: 'Masala Dosa', expectedCategory: 'dosa' },
    { name: 'Idli Sambar', expectedCategory: 'idly' },
    { name: 'Vegetable Samosa', expectedCategory: 'samosa' }
  ];

  for (const dish of testDishes) {
    try {
      console.log(`📝 Testing: ${dish.name}`);
      console.log(`   Expected category: ${dish.expectedCategory}`);
      
      const response = await axios.get(`https://foodish-api.herokuapp.com/api/images/${dish.expectedCategory}`);
      
      if (response.data && response.data.image) {
        console.log(`   ✅ Success: ${response.data.image}`);
      } else {
        console.log(`   ❌ No image returned`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
    
    // Small delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testFallbackImages() {
  console.log('🧪 Testing fallback image generation...\n');

  const testDishes = [
    'Chicken Tikka Masala',
    'Fish and Chips',
    'Sushi Roll',
    'Tacos',
    'Pad Thai'
  ];

  for (const dish of testDishes) {
    const seed = dish.toLowerCase().replace(/[^a-z0-9]/g, '');
    const imageUrl = `https://picsum.photos/seed/${seed}/400/300`;
    
    console.log(`📝 ${dish}`);
    console.log(`   Seed: ${seed}`);
    console.log(`   Fallback URL: ${imageUrl}`);
    console.log('');
  }
}

async function demonstrateMapping() {
  console.log('🧪 Demonstrating dish name to category mapping...\n');

  const testMappings = [
    'Chicken Biryani',
    'Mutton Biryani', 
    'Veg Biryani',
    'Cheese Burger',
    'Chicken Burger',
    'Butter Chicken',
    'Chicken Curry',
    'Fish Curry',
    'Margherita Pizza',
    'Pepperoni Pizza',
    'Chicken Pizza',
    'Spaghetti Pasta',
    'Penne Pasta',
    'Chocolate Cake',
    'Vanilla Ice Cream',
    'Gulab Jamun',
    'Fried Rice',
    'Jeera Rice',
    'Masala Dosa',
    'Plain Dosa',
    'Idli Sambar',
    'Mini Idli',
    'Samosa Chaat',
    'Aloo Samosa'
  ];

  function mapDishToCategory(dishName) {
    const dishLower = dishName.toLowerCase();
    
    if (dishLower.includes('biryani')) return 'biryani';
    else if (dishLower.includes('burger')) return 'burger';
    else if (dishLower.includes('chicken') || dishLower.includes('curry')) return 'butter-chicken';
    else if (dishLower.includes('dessert') || dishLower.includes('sweet') || dishLower.includes('cake') || dishLower.includes('ice cream')) return 'dessert';
    else if (dishLower.includes('dosa')) return 'dosa';
    else if (dishLower.includes('idly') || dishLower.includes('idli')) return 'idly';
    else if (dishLower.includes('pasta')) return 'pasta';
    else if (dishLower.includes('pizza')) return 'pizza';
    else if (dishLower.includes('rice')) return 'rice';
    else if (dishLower.includes('samosa')) return 'samosa';
    else return 'biryani'; // default
  }

  for (const dish of testMappings) {
    const category = mapDishToCategory(dish);
    console.log(`📝 ${dish.padEnd(20)} → ${category}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧪 Image Fetching Test Script

Usage:
  node test-image-fetching.js [test-type]

Test Types:
  api        Test Foodish API calls (default)
  fallback   Test fallback image generation
  mapping    Show dish name to category mapping
  all        Run all tests

Examples:
  node test-image-fetching.js
  node test-image-fetching.js api
  node test-image-fetching.js mapping
  node test-image-fetching.js all
    `);
    return;
  }

  const testType = args[0] || 'api';

  switch (testType) {
    case 'api':
      await testFoodishAPI();
      break;
    case 'fallback':
      await testFallbackImages();
      break;
    case 'mapping':
      await demonstrateMapping();
      break;
    case 'all':
      await testFoodishAPI();
      console.log('\n' + '='.repeat(50) + '\n');
      await testFallbackImages();
      console.log('\n' + '='.repeat(50) + '\n');
      await demonstrateMapping();
      break;
    default:
      console.log(`Unknown test type: ${testType}`);
      console.log('Use --help to see available options');
  }
}

if (require.main === module) {
  main().catch(console.error);
}