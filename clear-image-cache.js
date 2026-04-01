const imageService = require('./utils/imageService');

/**
 * Clear the image cache to test fresh results
 */
function clearImageCache() {
  console.log('🗑️ Clearing image cache...\n');
  
  const statsBefore = imageService.getCacheStats();
  console.log('📊 Cache before clearing:');
  console.log(`   Size: ${statsBefore.size} items`);
  console.log(`   Items: ${statsBefore.keys.join(', ')}`);
  
  imageService.clearCache();
  
  const statsAfter = imageService.getCacheStats();
  console.log('\n📊 Cache after clearing:');
  console.log(`   Size: ${statsAfter.size} items`);
  
  console.log('\n✅ Cache cleared successfully!');
}

clearImageCache();