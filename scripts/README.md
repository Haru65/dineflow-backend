# Menu Image Updater Scripts

This directory contains scripts to automatically fetch and assign food images to menu items based on their dish names.

## Available Scripts

### 1. Simple Menu Image Updater (`simple-menu-images.js`)

A straightforward script that uses free APIs to fetch food images without requiring API keys.

**Features:**
- Uses Foodish API for real food images
- Fallback to Lorem Picsum for consistent placeholder images
- No API keys required
- Intelligent dish name to image category mapping
- Caches results to avoid duplicate API calls
- Respects API rate limits

**Usage:**

```bash
# Update all menu items with images
npm run update-menu-images

# Check current image status
npm run menu-image-status

# Update specific tenant's menu items
node scripts/simple-menu-images.js update --tenant YOUR_TENANT_ID

# Update items matching a pattern
node scripts/simple-menu-images.js update --pattern "chicken"

# Force update even if images already exist
node scripts/simple-menu-images.js update --force

# Show help
node scripts/simple-menu-images.js --help
```

### 2. Advanced Menu Image Updater (`update-menu-images.js`)

A more advanced script that supports multiple image services including Unsplash and Pexels APIs.

**Features:**
- Support for Unsplash API (requires API key)
- Support for Pexels API (requires API key)
- Foodish API support (no API key)
- Better image quality and variety
- Attribution tracking

**Setup:**
1. Get API keys from [Unsplash](https://unsplash.com/developers) or [Pexels](https://www.pexels.com/api/)
2. Edit the script and add your API keys:
   ```javascript
   const UNSPLASH_ACCESS_KEY = 'YOUR_UNSPLASH_ACCESS_KEY';
   const PEXELS_API_KEY = 'YOUR_PEXELS_API_KEY';
   ```
3. Set the image service:
   ```javascript
   const IMAGE_SERVICE = 'unsplash'; // or 'pexels' or 'foodish'
   ```

## Image Mapping Logic

The scripts intelligently map dish names to appropriate food categories:

- **Biryani** → Biryani images
- **Chicken/Curry** → Butter chicken images
- **Pizza** → Pizza images
- **Burger** → Burger images
- **Pasta** → Pasta images
- **Rice** → Rice dish images
- **Dessert/Sweet/Cake** → Dessert images
- **Dosa** → Dosa images
- **Idly/Idli** → Idly images
- **Samosa** → Samosa images

## Database Schema

The scripts update the `image_url` column in the `menu_items` table:

```sql
UPDATE menu_items 
SET image_url = 'https://example.com/food-image.jpg', 
    updated_at = CURRENT_TIMESTAMP 
WHERE id = 'menu_item_id';
```

## API Services Used

### 1. Foodish API (Free)
- **URL:** https://foodish-api.herokuapp.com/
- **Pros:** Free, no API key required, real food images
- **Cons:** Limited categories, random images
- **Rate Limit:** Reasonable for small to medium usage

### 2. Unsplash API (Free tier available)
- **URL:** https://unsplash.com/developers
- **Pros:** High-quality images, good search
- **Cons:** Requires API key, rate limits
- **Rate Limit:** 50 requests/hour (free tier)

### 3. Pexels API (Free tier available)
- **URL:** https://www.pexels.com/api/
- **Pros:** High-quality images, good search
- **Cons:** Requires API key, rate limits
- **Rate Limit:** 200 requests/hour (free tier)

### 4. Lorem Picsum (Fallback)
- **URL:** https://picsum.photos/
- **Pros:** Always available, consistent images
- **Cons:** Not food-specific images
- **Usage:** Fallback when other services fail

## Examples

### Update all menu items
```bash
npm run update-menu-images
```

### Check what items need images
```bash
npm run menu-image-status
```

### Update only chicken dishes
```bash
node scripts/simple-menu-images.js update --pattern "chicken"
```

### Force update all images for a specific restaurant
```bash
node scripts/simple-menu-images.js update --tenant abc123 --force
```

## Output Example

```
🍽️  Starting menu image update...

Found 15 menu items to process.

📝 Processing: Chicken Biryani (ID: item_001)
  🔍 Searching image for: Chicken Biryani
  ✅ Updated with image from Foodish API

📝 Processing: Margherita Pizza (ID: item_002)
  🔍 Searching image for: Margherita Pizza
  ✅ Updated with image from Foodish API

📝 Processing: Chocolate Cake (ID: item_003)
  ⏭️  Already has image, skipping

📊 Summary:
✅ Updated: 12
⏭️  Skipped: 2
❌ Failed: 1
📝 Total: 15
```

## Troubleshooting

### Common Issues

1. **API Rate Limits**
   - The script includes delays between requests
   - Use `--pattern` to update specific items instead of all at once

2. **Network Errors**
   - The script will continue with other items if one fails
   - Check your internet connection

3. **Database Connection**
   - Ensure your `.env` file has correct `DATABASE_URL`
   - Make sure the database is running

4. **No Images Found**
   - Some dish names might not match available categories
   - The script will use fallback images in such cases

### Getting Help

Run any script with `--help` to see all available options:

```bash
node scripts/simple-menu-images.js --help
```