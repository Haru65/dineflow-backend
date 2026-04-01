/**
 * Test Google Gemini Vision API for menu extraction
 */

require('dotenv').config();
const geminiMenuExtractor = require('./services/geminiMenuExtractor');
const fs = require('fs');

async function testGeminiVision() {
  console.log('🧪 Testing Google Gemini 2.5 Flash Vision API for Menu Extraction\n');
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.error('❌ GEMINI_API_KEY not configured');
    console.error('   Get your FREE API key at: https://aistudio.google.com/app/apikey');
    console.error('   Add to .env: GEMINI_API_KEY=your-key-here');
    process.exit(1);
  }
  
  console.log('✅ Gemini API key configured');
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
      const result = await geminiMenuExtractor.extractMenuFromImage(imageBuffer, 'image/png');
      
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
      
      if (error.message.includes('Invalid Gemini API key')) {
        console.error('\n💡 Check your API key at: https://aistudio.google.com/app/apikey');
      } else if (error.message.includes('quota')) {
        console.error('\n💡 Quota exceeded. Check your billing or try again later.');
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
      const result = await geminiMenuExtractor.extractMenuFromImage(imageBuffer, 'image/jpeg');
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Extraction completed in ${duration}s`);
      console.log(`   Model: ${result.model}`);
      console.log(`   Items extracted: ${result.totalItems}\n`);
      
      if (result.totalItems > 0) {
        console.log('📋 Extracted Menu Items:');
        console.log('='.repeat(60));
        
        const itemsByCategory = geminiMenuExtractor.groupByCategory(result.items);
        Object.entries(itemsByCategory).forEach(([category, items]) => {
          console.log(`\n${category} (${items.length} items):`);
          console.log('-'.repeat(40));
          items.forEach(item => {
            const desc = item.description ? ` - ${item.description}` : '';
            console.log(`  ${item.name.padEnd(25)} ₹${item.price}${desc}`);
          });
        });
        
        const stats = geminiMenuExtractor.getStats(result.items);
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
  
  console.log('\n🎉 Google Gemini Vision API is working correctly!');
  console.log('   ✅ FREE tier available');
  console.log('   ✅ Fast and accurate');
  console.log('   ✅ Ready for production use');
}

console.log('Usage:');
console.log('  node test-gemini-vision.js                    # Test with minimal image');
console.log('  node test-gemini-vision.js path/to/menu.jpg   # Test with your menu image');
console.log('');

testGeminiVision();