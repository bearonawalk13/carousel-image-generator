const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');

// =============================================================
// CONFIGURATION - Edit these values to customize your slides
// =============================================================
const CONFIG = {
  // Image dimensions (Instagram carousel)
  width: 1080,
  height: 1350,

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
// FONT LOADING
// =============================================================

async function loadFont() {
  // Cormorant Garamond font URLs from Google Fonts (TTF format)
  const fontUrls = {
    regular: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_v86GnM.ttf',
    bold: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_hg9GnM.ttf',
    italic: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jDOjw.ttf',
    boldItalic: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd5FTfOjw.ttf'
  };

  const [regular, bold, italic, boldItalic] = await Promise.all([
    fetch(fontUrls.regular).then(r => r.arrayBuffer()),
    fetch(fontUrls.bold).then(r => r.arrayBuffer()),
    fetch(fontUrls.italic).then(r => r.arrayBuffer()),
    fetch(fontUrls.boldItalic).then(r => r.arrayBuffer())
  ]);

  return [
    { name: 'Cormorant Garamond', data: regular, weight: 400, style: 'normal' },
    { name: 'Cormorant Garamond', data: bold, weight: 700, style: 'normal' },
    { name: 'Cormorant Garamond', data: italic, weight: 400, style: 'italic' },
    { name: 'Cormorant Garamond', data: boldItalic, weight: 700, style: 'italic' }
  ];
}

// =============================================================
// SLIDE TEMPLATES (as React-like elements for Satori)
// =============================================================

function hookSlide(data, colors) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        padding: CONFIG.padding,
        textAlign: 'center',
        gap: 20
      },
      children: [
        data.title_line_1 ? {
          type: 'div',
          props: {
            style: {
              fontSize: CONFIG.sizes.hookTitle,
              fontWeight: 700,
              fontStyle: 'italic',
              color: colors.text,
              lineHeight: CONFIG.lineHeight
            },
            children: data.title_line_1
          }
        } : null,
        data.title_line_2 ? {
          type: 'div',
          props: {
            style: {
              fontSize: CONFIG.sizes.hookTitle,
              fontWeight: 700,
              fontStyle: 'italic',
              color: colors.gold,
              lineHeight: CONFIG.lineHeight
            },
            children: data.title_line_2
          }
        } : null
      ].filter(Boolean)
    }
  };
}

function bodySlide(data, colors) {
  const bodyLines = (data.body_lines || []).map(line => ({
    type: 'div',
    props: {
      style: {
        fontSize: CONFIG.sizes.bodyText,
        fontWeight: 400,
        color: colors.text,
        marginBottom: 16,
        lineHeight: CONFIG.lineHeight
      },
      children: line
    }
  }));

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        padding: CONFIG.padding
      },
      children: [
        data.headline ? {
          type: 'div',
          props: {
            style: {
              fontSize: CONFIG.sizes.bodyHeadline,
              fontWeight: 700,
              color: colors.text,
              marginBottom: CONFIG.headlineBodyGap,
              lineHeight: CONFIG.lineHeight
            },
            children: data.headline
          }
        } : null,
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: bodyLines
          }
        }
      ].filter(Boolean)
    }
  };
}

function ctaSlide(data, colors) {
  const lines = (data.lines || []).map(line => {
    let size = CONFIG.sizes.ctaBody;
    let color = colors.text;
    let weight = 400;

    if (line.style === 'title') {
      size = CONFIG.sizes.ctaTitle;
      weight = 600;
    } else if (line.style === 'action') {
      size = CONFIG.sizes.ctaAction;
      color = colors.gold;
      weight = 700;
    }

    return {
      type: 'div',
      props: {
        style: {
          fontSize: size,
          fontWeight: weight,
          color: color,
          marginBottom: 24,
          lineHeight: CONFIG.lineHeight,
          textAlign: 'center'
        },
        children: line.text
      }
    };
  });

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        padding: CONFIG.padding,
        textAlign: 'center'
      },
      children: lines
    }
  };
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

  try {
    const { type, theme = 'green', data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' });
    }

    const colors = CONFIG.themes[theme] || CONFIG.themes.green;

    // Generate slide element based on type
    let element;
    switch (type) {
      case 'hook':
        element = hookSlide(data, colors);
        break;
      case 'body':
        element = bodySlide(data, colors);
        break;
      case 'cta':
        element = ctaSlide(data, colors);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type. Use: hook, body, or cta' });
    }

    // Load fonts
    const fonts = await loadFont();

    // Render to SVG using Satori
    const svg = await satori(element, {
      width: CONFIG.width,
      height: CONFIG.height,
      fonts
    });

    // Convert SVG to PNG using Resvg
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: CONFIG.width
      }
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    // Return image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(pngBuffer);

  } catch (error) {
    console.error('Error generating image:', error);
    return res.status(500).json({ error: error.message });
  }
};
