# 🍽️ Menu Images Setup Guide

Get professional food images for your menu items automatically! This system works immediately with free APIs - no Google Cloud Platform required.

## 🚀 Quick Start (Works Right Now!)

### 1. Test Current Setup
Your system already works with free APIs:

```bash
npm run test-free-images
```

### 2. Check Menu Status
See which items have images:

```bash
npm run menu-image-status
```

### 3. Add Images to All Items
Automatically fetch images for all menu items:

```bash
npm run update-menu-images
```

## 🎯 What You Get Out of the Box

### Default (No Setup Required)
- **Foodish API**: Real food photos for common dishes
- **Smart fallbacks**: Consistent placeholder images
- **Works immediately**: No API keys needed

### With Free APIs (5-minute setup)
- **Unsplash**: Professional food photography (50 requests/hour free)
- **Pexels**: High-quality stock photos (200 requests/hour free)
- **Much better quality**: Restaurant-grade images

## 🆓 Upgrade to Free Premium APIs

### Option 1: Unsplash (Recommended)
1. **Go to [Unsplash Developers](https://unsplash.com/developers)**
2. **Create free account**
3. **Create app**: "DineFlow Menu Images"
4. **Copy Access Key**
5. **Add to .env**:
   ```env
   UNSPLASH_ACCESS_KEY=your_access_key_here
   ```

### Option 2: Pexels (More requests)
1. **Go to [Pexels API](https://www.pexels.com/api/)**
2. **Create free account**
3. **Get API key**
4. **Add to .env**:
   ```env
   PEXELS_API_KEY=your_api_key_here
   ```

### Option 3: Both (Best results)
```env
UNSPLASH_ACCESS_KEY=your_unsplash_key
PEXELS_API_KEY=your_pexels_key
```

**See `FREE_IMAGE_APIS_SETUP.md` for detailed setup instructions**

## Admin Interface Usage

### Adding New Menu Items
1. **Enter dish name** (e.g., "Chicken Tikka Masala")
2. **Click "Auto-fetch" button** next to Image URL field
3. **Image automatically appears** with preview
4. **Save the menu item**

### Updating Existing Items
1. **Click the blue image icon** on any menu item card
2. **System fetches new image** automatically
3. **Image updates instantly**

### Bulk Updates
1. **Click "Bulk Update Images"** button in admin menu
2. **Updates all items** without images
3. **Shows progress** and results summary

## How It Works

### 1. Image Source Priority
```
1. Google Images API (if configured) - High quality, relevant
2. Foodish API (free) - Good quality, limited categories  
3. Lorem Picsum (fallback) - Consistent placeholders
```

### 2. Smart Search Enhancement
The system enhances dish names for better Google results:
- **"Biryani"** → **"Biryani food dish restaurant"**
- **"Pizza Margherita"** → **"Pizza Margherita food dish restaurant"**
- **"Chocolate Cake"** → **"Chocolate Cake food dish restaurant"**

### 3. Automatic Integration
- **New items**: Images fetched automatically when created
- **Existing items**: Manual or bulk update available
- **Caching**: Results cached to avoid duplicate API calls

## Advanced Usage

### Update Specific Restaurant
```bash
node scripts/simple-menu-images.js update --tenant YOUR_TENANT_ID
```

### Update Specific Dishes
```bash
# Update only chicken dishes
node scripts/simple-menu-images.js update --pattern "chicken"

# Update only desserts
node scripts/simple-menu-images.js update --pattern "dessert"

# Update only pizza items
node scripts/simple-menu-images.js update --pattern "pizza"
```

### Force Update Existing Images
```bash
node scripts/simple-menu-images.js update --force
```

## How It Works

### 1. Intelligent Mapping
The script maps dish names to food categories:

- **"Chicken Biryani"** → Gets biryani images
- **"Margherita Pizza"** → Gets pizza images  
- **"Chocolate Cake"** → Gets dessert images
- **"Butter Chicken"** → Gets curry images

### 2. Free APIs Used
- **Foodish API**: Real food images (no API key needed)
- **Lorem Picsum**: Fallback placeholder images

### 3. Database Update
Updates the `image_url` column in your `menu_items` table.

## Example Output

```
🍽️  Starting menu image update...

Found 8 menu items to process.

📝 Processing: Chicken Biryani (ID: item_001)
  🔍 Searching image for: Chicken Biryani
  ✅ Updated with image from Foodish API

📝 Processing: Margherita Pizza (ID: item_002)
  🔍 Searching image for: Margherita Pizza
  ✅ Updated with image from Foodish API

📝 Processing: Chocolate Cake (ID: item_003)
  ⏭️  Already has image, skipping

📊 Summary:
✅ Updated: 6
⏭️  Skipped: 1
❌ Failed: 1
📝 Total: 8
```

## Supported Dish Categories

The script recognizes these dish types and fetches appropriate images:

| Dish Keywords | Image Category | Examples |
|---------------|----------------|----------|
| biryani | Biryani | Chicken Biryani, Mutton Biryani |
| burger | Burger | Cheese Burger, Chicken Burger |
| chicken, curry | Butter Chicken | Butter Chicken, Fish Curry |
| pizza | Pizza | Margherita Pizza, Pepperoni Pizza |
| pasta | Pasta | Spaghetti, Penne Pasta |
| rice | Rice | Fried Rice, Jeera Rice |
| dosa | Dosa | Masala Dosa, Plain Dosa |
| idli, idly | Idli | Idli Sambar, Mini Idli |
| samosa | Samosa | Aloo Samosa, Samosa Chaat |
| dessert, cake, sweet | Dessert | Chocolate Cake, Ice Cream |

## Frontend Integration

Once images are added, they'll automatically appear in your frontend:

```tsx
// In your MenuItemCard component
<img 
  src={menuItem.image_url || '/placeholder-food.jpg'} 
  alt={menuItem.name}
  className="menu-item-image"
/>
```

## Troubleshooting

### No Images Appearing?
1. Check if the script ran successfully
2. Verify database connection
3. Check if `image_url` column exists in `menu_items` table

### API Errors?
1. Check internet connection
2. The script includes fallback images if APIs fail
3. Try running with a smaller pattern first

### Want Better Images?
1. Use the advanced script with Unsplash/Pexels APIs
2. Edit `scripts/update-menu-images.js` and add your API keys
3. Set `IMAGE_SERVICE = 'unsplash'` or `'pexels'`

## Manual Image URLs

You can also manually set image URLs through the admin panel or API:

```bash
curl -X PUT "http://localhost:3000/api/restaurant/TENANT_ID/menu/items/ITEM_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://example.com/food-image.jpg"}'
```

## Next Steps

1. **Run the script**: `npm run update-menu-images`
2. **Check your frontend**: Images should now appear on menu items
3. **Customize**: Edit the mapping logic in the script for your specific needs
4. **Automate**: Set up a cron job to run this periodically for new menu items

Need help? Check the detailed documentation in `scripts/README.md`