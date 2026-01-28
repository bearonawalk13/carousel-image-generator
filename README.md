# Carousel Image Generator

Generate beautiful carousel slide images with perfect text positioning. No more spacing issues.

## Setup (5 minutes)

### Step 1: Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/carousel-image-generator)

Or manually:
1. Fork this repo to your GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project" → Import your forked repo
4. Click "Deploy"

### Step 2: Get Your Endpoint URL

After deploy, your endpoint will be:
```
https://your-project-name.vercel.app/api/generate
```

### Step 3: Use in n8n

In your n8n workflow, use an HTTP Request node:
- Method: POST
- URL: `https://your-project-name.vercel.app/api/generate`
- Body (JSON):

```json
{
  "type": "body",
  "theme": "green",
  "data": {
    "headline": "Your headline here",
    "body_lines": ["Line 1", "Line 2", "Line 3"]
  }
}
```

---

## API Reference

### Endpoint
```
POST /api/generate
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Slide type: `hook`, `body`, or `cta` |
| theme | string | No | Color theme: `green`, `white`, or `black` (default: green) |
| data | object | Yes | Slide content (see below) |

### Slide Types

#### Hook Slide
```json
{
  "type": "hook",
  "theme": "green",
  "data": {
    "title_line_1": "The armor that kept you safe...",
    "title_line_2": "now keeps love out."
  }
}
```

#### Body Slide
```json
{
  "type": "body",
  "theme": "green",
  "data": {
    "headline": "The walls go up.",
    "body_lines": [
      "The questions start.",
      "Your brain won't shut up.",
      "And you think... what is WRONG with me?"
    ]
  }
}
```

#### CTA Slide
```json
{
  "type": "cta",
  "theme": "green",
  "data": {
    "lines": [
      { "text": "If this landed...", "style": "title" },
      { "text": "DM \"SPIRAL\"", "style": "action" },
      { "text": "for a free 5-minute reset toolkit.", "style": "body" },
      { "text": "For when you're spinning, stuck, or shut down.", "style": "body" }
    ]
  }
}
```

### Response

Returns a PNG image (Content-Type: image/png)

---

## Customization

Edit `api/generate.js` and modify the `CONFIG` object at the top:

```javascript
const CONFIG = {
  // Image dimensions
  width: 1080,
  height: 1350,

  // Fonts
  fontFamily: "'Cormorant Garamond', serif",

  // Theme colors
  themes: {
    green: {
      background: '#0c1f1a',
      text: '#f5f3ef',
      gold: '#c59b3d'
    }
    // ... add more themes
  },

  // Font sizes
  sizes: {
    hookTitle: 72,
    bodyHeadline: 56,
    bodyText: 48,
    // ...
  }
};
```

After editing, push to GitHub and Vercel will auto-deploy.

---

## Limits

Vercel free tier:
- 100 GB bandwidth/month
- 100,000 function invocations/month
- More than enough for 1000+ carousels/month

---

## Troubleshooting

**Images look wrong?**
- Check the theme name is correct (green, white, black)
- Verify JSON structure matches examples above

**Timeout errors?**
- First request after idle may be slow (cold start)
- Subsequent requests are fast

**Need help?**
- Check Vercel function logs in your dashboard
