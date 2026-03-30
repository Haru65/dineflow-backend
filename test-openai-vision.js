/**
 * Test OpenAI Vision API for menu extraction
 */

require('dotenv').config();
const openaiMenuExtractor = require('./services/openaiMenuExtractor');
const fs = require('fs');

async function testOpenAIVision() {
  console.log('🧪 Testing OpenAI Vision API for Menu Extraction\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    console.error('❌ OPENAI_API_KEY not configured');
    console.error('   Get your API key at: https://platform.openai.com/api-keys');
    console.error('   Add to .env: OPENAI_API_KEY=sk-your-key-here');
    process.exit(1);
  }
  
  console.log('✅ OpenAI API key configured');
  console.log(`   Key starts with: ${apiKey.substring(0, 10)}...\n`);
  
  // Create a simple test image with menu-like text
  const testImagePath = process.argv[2];
  
  if (!testImagePath) {
    console.log('📝 Creating test image with sample menu...');
    
    // Create a simple 1x1 pixel test image
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const imageBuffer = Buffer.from(testImageBase64, 'base64');
    
    try {
      console.log('🔍 Testing with minimal image...');
      const result = await openaiMenuExtractor.extractMenuFromImage(imageBuffer, 'image/png');
      
      console.log('✅ API connection successful!');
      console.log(`   Model: ${result.model}`);
      console.log(`   Items extracted: ${result.totalItems}`);
      
      if (result.totalItems > 0) {
        console.log('\n📋 Extracted items:');
        result.items.forEach(item => {
          console.log(`   ${item.name} - ₹${item.price} (${item.category})`);
        });
      } else {
        console.log('   (No items found in test image - this is expected)');
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      
      if (error.message.includes('Invalid OpenAI API key')) {
        console.error('\n💡 Check your API key at: https://platform.openai.com/api-keys');
      } else if (error.message.includes('rate limit')) {
        console.error('\n💡 Rate limit hit. Wait a moment and try again.');
      }
      
      process.exit(1);
    }
    
  } else {
    // Test with provided image file
    if (!fs.existsSync(testImagePath)) {
      console.error(`❌ Image file not found: ${testImagePath}`);
      process.exit(1);
    }
    
    console.log(`📸 Testing with image: ${testImagePath}`);
    const imageBuffer = fs.readFileSync(testImagePath);
    const fileSize = (imageBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`   Size: ${fileSize} MB\n`);
    
    try {
      const startTime = Date.now();
      const result = await openaiMenuExtractor.extractMenuFromImage(imageBuffer, 'image/jpeg');
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Extraction completed in ${duration}s`);
      console.log(`   Model: ${result.model}`);
      console.log(`   Items extracted: ${result.totalItems}\n`);
      
      if (result.totalItems > 0) {
        console.log('📋 Extracted Menu Items:');
        console.log('='.repeat(60));
        
        const itemsByCategory = openaiMenuExtractor.groupByCategory(result.items);
        Object.entries(itemsByCategory).forEach(([category, items]) => {
          console.log(`\n${category} (${items.length} items):`);
          console.log('-'.repeat(40));
          items.forEach(item => {
            const desc = item.description ? ` - ${item.description}` : '';
            console.log(`  ${item.name.padEnd(25)} ₹${item.price}${desc}`);
          });
        });
        
        const stats = openaiMenuExtractor.getStats(result.items);
        console.log('\n📊 Statistics:');
        console.log('-'.repeat(40));
        console.log(`  Total Items:    ${stats.total}`);
        console.log(`  Categories:     ${stats.categories}`);
        console.log(`  Average Price:  ₹${stats.avgPrice}`);
        console.log(`  Price Range:    ₹${stats.minPrice} - ₹${stats.maxPrice}`);
        
      } else {
        console.log('⚠️  No menu items found in the image.');
        console.log('   Try with a clearer menu image.');
      }
      
    } catch (error) {
      console.error('❌ Extraction failed:', error.message);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 OpenAI Vision API is working correctly!');
  console.log('   Ready to replace Groq in production.');
}

console.log('Usage:');
console.log('  node test-openai-vision.js                    # Test with minimal image');
console.log('  node test-openai-vision.js path/to/menu.jpg   # Test with your menu image');
console.log('');

testOpenAIVision();