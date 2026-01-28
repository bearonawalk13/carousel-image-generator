const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// =============================================================
// CONFIGURATION - Edit these values to customize your slides
// =============================================================
const CONFIG = {
  // Image dimensions (Instagram carousel)
  width: 1080,
  height: 1350,

  // Fonts
  fontFamily: "'Cormorant Garamond', serif",
  googleFont: "Cormorant+Garamond:wght@400;600;700",

  // Theme colors
  themes: {
    green: {
      background: '#0c1f1a',
      text: '#f5f3ef',
      gold: '#c59b3d'
    },
    white: {
      background: '#f5f3ef',
      text: '#0c1f1a',
      gold: '#c59b3d'
    },
    black: {
      background: '#1a1a1a',
      text: '#f5f3ef',
      gold: '#c59b3d'
    }
  },

  // Typography sizes
  sizes: {
    hookTitle: 72,
    bodyHeadline: 56,
    bodyText: 48,
    ctaTitle: 56,
    ctaAction: 72,
    ctaBody: 48
  },

  // Spacing
  padding: 80,
  lineHeight: 1.4,
  headlineBodyGap: 40
};

// =============================================================
// HTML TEMPLATES
// =============================================================

function baseStyles(theme) {
  const colors = CONFIG.themes[theme] || CONFIG.themes.green;
  return `
    @import url('https://fonts.googleapis.com/css2?family=${CONFIG.googleFont}&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: ${CONFIG.width}px;
      height: ${CONFIG.height}px;
      background: ${colors.background};
      font-family: ${CONFIG.fontFamily};
      color: ${colors.text};
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: ${CONFIG.padding}px;
      line-height: ${CONFIG.lineHeight};
    }

    .gold { color: ${colors.gold}; }
    .bold { font-weight: 700; }
    .italic { font-style: italic; }
    .center { text-align: center; }
  `;
}

function hookTemplate(data, theme) {
  const colors = CONFIG.themes[theme] || CONFIG.themes.green;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        ${baseStyles(theme)}
        .hook-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 20px;
        }
        .hook-line {
          font-size: ${CONFIG.sizes.hookTitle}px;
          font-weight: 700;
          font-style: italic;
        }
        .line1 { color: ${colors.text}; }
        .line2 { color: ${colors.gold}; }
      </style>
    </head>
    <body>
      <div class="hook-container">
        <div class="hook-line line1">${data.title_line_1 || ''}</div>
        <div class="hook-line line2">${data.title_line_2 || ''}</div>
      </div>
    </body>
    </html>
  `;
}

function bodyTemplate(data, theme) {
  const colors = CONFIG.themes[theme] || CONFIG.themes.green;
  const bodyLines = (data.body_lines || []).map(line =>
    `<div class="body-line">${line}</div>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        ${baseStyles(theme)}
        .body-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100%;
        }
        .headline {
          font-size: ${CONFIG.sizes.bodyHeadline}px;
          font-weight: 700;
          margin-bottom: ${CONFIG.headlineBodyGap}px;
          color: ${colors.text};
        }
        .body-line {
          font-size: ${CONFIG.sizes.bodyText}px;
          font-weight: 400;
          margin-bottom: 16px;
          color: ${colors.text};
        }
      </style>
    </head>
    <body>
      <div class="body-container">
        ${data.headline ? `<div class="headline">${data.headline}</div>` : ''}
        <div class="body-content">${bodyLines}</div>
      </div>
    </body>
    </html>
  `;
}

function ctaTemplate(data, theme) {
  const colors = CONFIG.themes[theme] || CONFIG.themes.green;
  const lines = (data.lines || []).map(line => {
    let size = CONFIG.sizes.ctaBody;
    let color = colors.text;
    let weight = '400';

    if (line.style === 'title') {
      size = CONFIG.sizes.ctaTitle;
      weight = '600';
    } else if (line.style === 'action') {
      size = CONFIG.sizes.ctaAction;
      color = colors.gold;
      weight = '700';
    }

    return `<div style="font-size: ${size}px; color: ${color}; font-weight: ${weight}; margin-bottom: 24px;">${line.text}</div>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        ${baseStyles(theme)}
        .cta-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          height: 100%;
        }
      </style>
    </head>
    <body>
      <div class="cta-container">
        ${lines}
      </div>
    </body>
    </html>
  `;
}

// =============================================================
// MAIN HANDLER
// =============================================================

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;

  try {
    const { type, theme = 'green', data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' });
    }

    // Generate HTML based on slide type
    let html;
    switch (type) {
      case 'hook':
        html = hookTemplate(data, theme);
        break;
      case 'body':
        html = bodyTemplate(data, theme);
        break;
      case 'cta':
        html = ctaTemplate(data, theme);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type. Use: hook, body, or cta' });
    }

    // Configure chromium for Vercel
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    // Launch browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: CONFIG.width,
        height: CONFIG.height
      },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    const screenshot = await page.screenshot({ type: 'png' });
    await browser.close();
    browser = null;

    // Return image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(screenshot);

  } catch (error) {
    console.error('Error generating image:', error);
    if (browser) {
      await browser.close();
    }
    return res.status(500).json({ error: error.message });
  }
};
