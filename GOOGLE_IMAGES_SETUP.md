# 🖼️ Google Images API Setup Guide

This guide shows you how to set up Google Custom Search API to automatically fetch high-quality food images for your menu items.

## Why Google Images?

- **High Quality**: Real food photos from restaurants and food blogs
- **Relevant Results**: Better matching for specific dish names
- **Reliable**: Google's robust image search infrastructure
- **Fallback Support**: System falls back to free APIs if Google isn't configured

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable billing (required for API usage)

### 2. Enable Custom Search API

1. Go to **APIs & Services** > **Library**
2. Search for "Custom Search API"
3. Click **Enable**

### 3. Create API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the API key
4. **Restrict the key** (recommended):
   - Click on the key to edit
   - Under **API restrictions**, select "Custom Search API"
   - Under **Application restrictions**, add your server IP

### 4. Create Custom Search Engine

1. Go to [Google Custom Search](https://cse.google.com/cse/)
2. Click **Add** to create new search engine
3. **Sites to search**: Enter `*` (to search entire web)
4. **Name**: "DineFlow Food Images"
5. Click **Create**
6. In the **Setup** tab:
   - Turn ON **Image search**
   - Turn ON **SafeSearch**
7. Copy the **Search engine ID** from the **Setup** tab

### 5. Configure Environment Variables

Add these to your `.env` file:

```env
# Google Images API Configuration
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_custom_search_engine_id_here
```

### 6. Test the Setup

Run the test script to verify everything works:

```bash
npm run test-image-api
```

Or test with a specific dish:

```bash
node -e "
const imageService = require('./utils/imageService');
imageService.autoFetchImageForMenuItem('Chicken Biryani').then(console.log);
"
```

## Usage Limits & Pricing

### Free Tier
- **100 queries per day** for free
- Perfect for small restaurants

### Paid Usage
- **$5 per 1,000 queries** after free tier
- For busy restaurants with frequent menu updates

### Cost Estimation
- **Small restaurant** (50 items): ~$0.25 one-time setup
- **Large restaurant** (200 items): ~$1.00 one-time setup
- **Daily updates** (10 new items/day): ~$1.50/month

## How It Works

### 1. Automatic Image Fetching
When admin adds a new menu item:
```
Admin enters "Butter Chicken" → 
Google searches "Butter Chicken food dish restaurant" → 
Returns high-quality food image → 
Image automatically saved to menu item
```

### 2. Fallback System
```
Google Images (if configured) → 
Foodish API (free) → 
Lorem Picsum (placeholder)
```

### 3. Smart Search Queries
The system enhances dish names for better results:
- "Biryani" → "Biryani food dish restaurant"
- "Pizza Margherita" → "Pizza Margherita food dish restaurant"

## Admin Interface Features

### Add New Item
1. Enter dish name (e.g., "Chicken Tikka")
2. Click **Auto-fetch** button
3. Image automatically appears
4. Save the menu item

### Update Existing Items
1. Click the blue **image icon** on any menu item
2. System fetches new image automatically
3. Image updates instantly

### Bulk Update
1. Click **Bulk Update Images** button
2. Updates all items without images
3. Shows progress and results

## Troubleshooting

### No Images Found?
1. **Check API credentials** in `.env` file
2. **Verify API is enabled** in Google Cloud Console
3. **Check quota limits** in Google Cloud Console
4. **Try simpler dish names** (e.g., "Pizza" instead of "Artisanal Wood-Fired Pizza")

### API Errors?
1. **Invalid API Key**: Check the key is correct and unrestricted
2. **Quota Exceeded**: Check usage in Google Cloud Console
3. **Search Engine ID**: Verify the Custom Search Engine ID

### Poor Image Quality?
1. **Refine search terms** in the image service
2. **Add more specific keywords** to search queries
3. **Filter by image size** (already set to 'medium')

## Advanced Configuration

### Custom Search Parameters
Edit `utils/imageService.js` to customize:

```javascript
const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
  params: {
    key: this.googleApiKey,
    cx: this.googleSearchEngineId,
    q: searchQuery,
    searchType: 'image',
    imgType: 'photo',        // photo, clipart, lineart
    imgSize: 'medium',       // small, medium, large, xlarge
    safe: 'active',          // SafeSearch
    num: 3,                  // Number of results
    fileType: 'jpg,png,jpeg' // Allowed formats
  }
});
```

### Search Query Enhancement
Customize how dish names are converted to search queries:

```javascript
// In utils/imageService.js
const searchQuery = `${dishName} food dish restaurant indian cuisine`;
```

## Security Best Practices

### 1. Restrict API Key
- **Application restrictions**: Add your server IP
- **API restrictions**: Only allow Custom Search API
- **Referrer restrictions**: Add your domain

### 2. Monitor Usage
- Set up **billing alerts** in Google Cloud
- Monitor **API usage** regularly
- Set **quota limits** to prevent overuse

### 3. Environment Security
- Never commit `.env` files to version control
- Use different API keys for development/production
- Rotate API keys periodically

## Alternative Free Options

If you prefer not to use Google Images API:

### 1. Foodish API (Current Default)
- **Free**: No API key required
- **Limited**: Only specific food categories
- **Quality**: Good but limited variety

### 2. Unsplash API
- **Free**: 50 requests/hour
- **High Quality**: Professional food photography
- **Setup**: Requires API key

### 3. Pexels API
- **Free**: 200 requests/hour
- **Good Quality**: Stock food photos
- **Setup**: Requires API key

## Next Steps

1. **Set up Google API** following this guide
2. **Test with a few menu items** to verify quality
3. **Bulk update existing items** if satisfied
4. **Monitor usage** and costs
5. **Customize search parameters** if needed

Need help? Check the troubleshooting section or contact support.