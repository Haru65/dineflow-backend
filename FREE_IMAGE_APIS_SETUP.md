# 🆓 Free Image APIs Setup Guide

Get high-quality food images for your menu without Google Cloud Platform! This guide shows you how to set up free image APIs that provide professional food photography.

## 🎯 What You Get

### Without Any Setup (Default)
- **Foodish API**: Real food photos for common dishes (biryani, pizza, etc.)
- **Lorem Picsum**: Consistent placeholder images
- **Works immediately** - no API keys needed

### With Free APIs (Recommended)
- **Unsplash**: Professional food photography (50 requests/hour free)
- **Pexels**: High-quality stock photos (200 requests/hour free)
- **Much better image quality** and variety

## 🚀 Quick Setup (5 minutes)

### Option 1: Unsplash (Recommended)

1. **Go to [Unsplash Developers](https://unsplash.com/developers)**
2. **Create account** (free)
3. **Create new app**:
   - App name: "DineFlow Menu Images"
   - Description: "Restaurant menu image fetching"
4. **Copy Access Key**
5. **Add to .env file**:
   ```env
   UNSPLASH_ACCESS_KEY=your_access_key_here
   ```

**Limits**: 50 requests/hour (perfect for small-medium restaurants)

### Option 2: Pexels (Alternative)

1. **Go to [Pexels API](https://www.pexels.com/api/)**
2. **Create account** (free)
3. **Get API key** from dashboard
4. **Add to .env file**:
   ```env
   PEXELS_API_KEY=your_api_key_here
   ```

**Limits**: 200 requests/hour (great for larger restaurants)

### Option 3: Both (Best Coverage)

Set up both APIs for maximum image variety:
```env
UNSPLASH_ACCESS_KEY=your_unsplash_key_here
PEXELS_API_KEY=your_pexels_key_here
```

System will try Unsplash first, then Pexels, then fallback to Foodish API.

## 🧪 Test Your Setup

```bash
# Test all image sources
npm run test-google-images

# Check current menu status
npm run menu-image-status

# Update all menu items with images
npm run update-menu-images
```

## 📊 Image Quality Comparison

| Source | Quality | Variety | Limits | Setup |
|--------|---------|---------|--------|-------|
| **Unsplash** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 50/hour | 2 min |
| **Pexels** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 200/hour | 2 min |
| **Foodish** | ⭐⭐⭐ | ⭐⭐ | Unlimited | None |
| **Fallback** | ⭐ | ⭐ | Unlimited | None |

## 🎨 Image Examples

### Unsplash Results
- **"Chicken Biryani"** → Professional restaurant photography
- **"Chocolate Cake"** → High-end bakery shots
- **"Pizza Margherita"** → Artisanal food photography

### Pexels Results  
- **"Butter Chicken"** → Clean, well-lit food photos
- **"Pasta"** → Stock photography quality
- **"Salad"** → Fresh, appealing images

### Foodish API Results
- **"Biryani"** → Real food photos (limited categories)
- **"Pizza"** → Decent quality images
- **"Dessert"** → Basic food photography

## 💡 Pro Tips

### 1. Use Both APIs
```env
# Best setup for maximum coverage
UNSPLASH_ACCESS_KEY=your_unsplash_key
PEXELS_API_KEY=your_pexels_key
```

### 2. Monitor Usage
- **Unsplash**: Check usage at [unsplash.com/developers](https://unsplash.com/developers)
- **Pexels**: Monitor at [pexels.com/api](https://www.pexels.com/api/)

### 3. Optimize Requests
- **Bulk update** during off-hours
- **Cache results** (already implemented)
- **Use descriptive dish names** for better results

## 🔧 How It Works

### Image Source Priority
```
1. Unsplash API (if configured) - Professional photos
2. Pexels API (if configured) - Stock photos  
3. Foodish API (always available) - Basic food images
4. Lorem Picsum (always available) - Placeholders
```

### Smart Search Queries
- **"Chicken Tikka"** → **"Chicken Tikka food dish"**
- **"Chocolate Cake"** → **"Chocolate Cake food dish"**
- **"Biryani"** → **"Biryani food dish"**

### Automatic Fallback
If one API fails, system automatically tries the next one. Your menu always gets images!

## 📱 Admin Interface

### Adding New Items
1. **Enter dish name**: "Butter Chicken"
2. **Click Auto-fetch**: System searches all configured APIs
3. **Image appears**: High-quality food photo
4. **Save item**: Image stored with menu item

### Updating Existing Items
1. **Click image icon** on menu item
2. **System fetches new image** from best available source
3. **Image updates** automatically

## 🚫 No Setup Required

Even without any API keys, you still get:
- **Foodish API images** for common dishes
- **Consistent placeholders** for all items
- **Fully functional system** - no broken images

## 🆙 Upgrade Path

### Start Free
1. **Use default setup** (Foodish + placeholders)
2. **Test the system** with your menu
3. **See how it works** for your restaurant

### Add Free APIs
1. **Set up Unsplash** (5 minutes)
2. **Much better image quality**
3. **Professional appearance**

### Future Options
1. **Paid APIs** for unlimited usage
2. **Custom image upload** feature
3. **AI-generated images** integration

## 🔍 Troubleshooting

### No Images Appearing?
1. **Check API keys** in .env file
2. **Restart server** after adding keys
3. **Test with simple dish names** first

### Poor Image Quality?
1. **Add Unsplash API** for better photos
2. **Use specific dish names** (not generic terms)
3. **Try different search terms**

### API Limits Reached?
1. **Set up second API** (Pexels if using Unsplash)
2. **Spread updates** throughout the day
3. **Consider paid plans** for high-volume usage

## 📈 Usage Recommendations

### Small Restaurant (< 50 items)
- **Unsplash only**: 50 requests/hour is plenty
- **One-time setup**: Update all items once

### Medium Restaurant (50-100 items)  
- **Pexels**: 200 requests/hour for bulk updates
- **Or both APIs**: Maximum coverage

### Large Restaurant (100+ items)
- **Both APIs**: Unsplash + Pexels
- **Stagger updates**: Spread over multiple days

## 🎉 Ready to Go!

Your menu image system is ready to use:

1. **Works immediately** with default free APIs
2. **Add Unsplash/Pexels** for better quality (optional)
3. **Professional food images** enhance your menu
4. **Customers see appealing photos** that increase orders

No Google Cloud Platform needed - you get great results with free alternatives!