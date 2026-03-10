# 🍽️ Menu Images Setup Guide

This guide shows you how to automatically add food images to your menu items based on their dish names.

## Quick Start

### 1. Check Current Status
First, see which menu items currently have images:

```bash
npm run menu-image-status
```

### 2. Update All Menu Items
Add images to all menu items that don't have them:

```bash
npm run update-menu-images
```

### 3. Test the Image API
Test if the image fetching is working:

```bash
npm run test-image-api
```

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