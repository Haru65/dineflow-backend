/**
 * test-groq-extraction.js
 * Test script for Groq menu extraction
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const groqMenuExtractor = require('./services/groqMenuExtractor');

async function testGroqExtraction() {
  console.log('🧪 Testing Groq Menu Extraction\n');

  // Check API key
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY not found in .env file');
    console.log('\nPlease add your Groq API key to .env:');
    console.log('GROQ_API_KEY=gsk_your_key_here\n');
    console.log('Get your key at: https://console.groq.com/');
    process.exit(1);
  }

  console.log('✅ GROQ_API_KEY found');
  console.log(`   Key: ${process.env.GROQ_API_KEY.substring(0, 20)}...\n`);

  // Check for test image
  const testImagePath = process.argv[2];
  
  if (!testImagePath) {
    console.log('Usage: node test-groq-extraction.js <path-to-menu-image>');
    console.log('\nExample:');
    console.log('  node test-groq-extraction.js ./test-menu.jpg');
    console.log('  node test-groq-extraction.js C:\\Users\\YourName\\Downloads\\menu.png\n');
    process.exit(1);
  }

  if (!fs.existsSync(testImagePath)) {
    console.error(`❌ Image file not found: ${testImagePath}`);
    process.exit(1);
  }

  console.log(`📸 Loading image: ${testImagePath}`);
  const imageBuffer = fs.readFileSync(testImagePath);
  const fileSize = (imageBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`   Size: ${fileSize} MB\n`);

  // Determine mime type
  const ext = path.extname(testImagePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };
  const mimeType = mimeTypes[ext] || 'image/jpeg';

  console.log('🤖 Sending to Groq Vision API...');
  console.log('   Model: llama-3.2-90b-vision-preview');
  console.log('   This may take 5-15 seconds...\n');

  try {
    const startTime = Date.now();
    const result = await groqMenuExtractor.extractMenuFromImage(imageBuffer, mimeType);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Extraction completed in ${duration}s\n`);
    console.log('📊 Results:');
    console.log(`   Total Items: ${result.totalItems}`);
    console.log(`   Model Used: ${result.model}\n`);

    if (result.items.length === 0) {
      console.log('⚠️  No items extracted. The image may not contain a clear menu.\n');
      return;
    }

    // Display items by category
    const itemsByCategory = groqMenuExtractor.groupByCategory(result.items);
    console.log('📋 Extracted Menu Items:\n');

    Object.entries(itemsByCategory).forEach(([category, items]) => {
      console.log(`\n${category} (${items.length} items):`);
      console.log('─'.repeat(60));
      items.forEach(item => {
        const desc = item.description ? ` - ${item.description}` : '';
        console.log(`  ${item.name.padEnd(35)} ₹${item.price}${desc}`);
      });
    });

    // Display statistics
    const stats = groqMenuExtractor.getStats(result.items);
    console.log('\n\n📈 Statistics:');
    console.log('─'.repeat(60));
    console.log(`  Total Items:     ${stats.total}`);
    console.log(`  Categories:      ${stats.categories}`);
    console.log(`  Average Price:   ₹${stats.avgPrice}`);
    console.log(`  Price Range:     ₹${stats.minPrice} - ₹${stats.maxPrice}`);

    // Save to file
    const outputPath = 'extracted-menu.json';
    fs.writeFileSync(outputPath, JSON.stringify(result.items, null, 2));
    console.log(`\n💾 Full results saved to: ${outputPath}\n`);

    console.log('✅ Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Extraction failed:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 Check your GROQ_API_KEY in .env file');
      console.log('   Get a key at: https://console.groq.com/\n');
    } else if (error.message.includes('rate limit')) {
      console.log('\n💡 Rate limit exceeded. Wait a few minutes and try again.\n');
    } else if (error.message.includes('timeout')) {
      console.log('\n💡 Request timed out. Try a smaller image or better internet connection.\n');
    }
    
    process.exit(1);
  }
}

testGroqExtraction();
