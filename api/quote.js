const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');

// =============================================================
// QUOTE IMAGE GENERATOR - Independent endpoint for Quote Posts
// =============================================================

const CONFIG = {
  handle: 'BASTIANGUGGER',

  // Platform-specific dimensions
  sizes: {
    instagram: { width: 1080, height: 1350 },  // 4:5 portrait
    threads: { width: 1080, height: 1350 },    // Same as Instagram
    linkedin: { width: 1200, height: 1200 },   // 1:1 square
    facebook: { width: 1200, height: 630 }     // 1.91:1 landscape
  },

  // Same themes as carousel
  themes: {
    green: {
      background: '#0c1f1a',
      text: '#f5f3ef',
      gold: '#c59b3d'
    },
    white: {
      background: '#ede5d8',
      text: '#0c1f1a',
      gold: '#c59b3d'
    },
    black: {
      background: '#0a1315',
      text: '#f5f3ef',
      gold: '#c59b3d'
    }
  },

  // Design elements
  design: {
    cornerSize: 15,
    handleBottom: 70,
    handleLeft: 70,
    handleFontSize: 30,
    handleLetterSpacing: 6
  },

  padding: 100,
  lineHeight: 1.4
};

// Font configuration (same as carousel)
const FONT_CONFIG = {
  name: 'Cormorant Garamond',
  urls: {
    regular: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_v86GnM.ttf',
    medium: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_s06GnM.ttf',
    bold: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_hg9GnM.ttf',
    italic: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jDOjw.ttf',
    mediumItalic: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd5wDDOjw.ttf',
    boldItalic: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd5FTfOjw.ttf'
  }
};

async function loadFont() {
  const fetches = [
    fetch(FONT_CONFIG.urls.regular).then(r => r.arrayBuffer()),
    fetch(FONT_CONFIG.urls.bold).then(r => r.arrayBuffer()),
    fetch(FONT_CONFIG.urls.italic).then(r => r.arrayBuffer()),
    fetch(FONT_CONFIG.urls.boldItalic).then(r => r.arrayBuffer()),
    fetch(FONT_CONFIG.urls.medium).then(r => r.arrayBuffer()),
    fetch(FONT_CONFIG.urls.mediumItalic).then(r => r.arrayBuffer())
  ];

  const [regular, bold, italic, boldItalic, medium, mediumItalic] = await Promise.all(fetches);

  return [
    { name: FONT_CONFIG.name, data: regular, weight: 400, style: 'normal' },
    { name: FONT_CONFIG.name, data: bold, weight: 700, style: 'normal' },
    { name: FONT_CONFIG.name, data: italic, weight: 400, style: 'italic' },
    { name: FONT_CONFIG.name, data: boldItalic, weight: 700, style: 'italic' },
    { name: FONT_CONFIG.name, data: medium, weight: 500, style: 'normal' },
    { name: FONT_CONFIG.name, data: mediumItalic, weight: 500, style: 'italic' }
  ];
}

// =============================================================
// DESIGN ELEMENTS
// =============================================================

// Handle with corner brackets (bottom-left)
function handleElement(colors) {
  const d = CONFIG.design;
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: d.handleBottom,
        left: d.handleLeft,
        display: 'flex',
        alignItems: 'center'
      },
      children: [
        // Corner bracket bottom-left
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: 3,
              left: 3,
              width: d.cornerSize,
              height: d.cornerSize,
              borderLeft: `1px solid ${colors.gold}`,
              borderBottom: `1px solid ${colors.gold}`,
              opacity: 0.6
            }
          }
        },
        // Handle text
        {
          type: 'div',
          props: {
            style: {
              fontSize: d.handleFontSize,
              fontWeight: 500,
              letterSpacing: d.handleLetterSpacing,
              textTransform: 'uppercase',
              color: colors.text,
              opacity: 0.7,
              padding: '5px 10px'
            },
            children: CONFIG.handle
          }
        },
        // Corner bracket top-right
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 3,
              right: 10,
              width: d.cornerSize,
              height: d.cornerSize,
              borderRight: `1px solid ${colors.gold}`,
              borderTop: `1px solid ${colors.gold}`,
              opacity: 0.6
            }
          }
        }
      ]
    }
  };
}

// Soft chevron pointing down (below quote)
function chevronDown(colors, width) {
  const chevronWidth = 60;
  const chevronHeight = 30;
  const strokeWidth = 2;

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: 180,
        left: (width - chevronWidth) / 2,
        width: chevronWidth,
        height: chevronHeight,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      },
      children: {
        type: 'svg',
        props: {
          width: chevronWidth,
          height: chevronHeight,
          viewBox: `0 0 ${chevronWidth} ${chevronHeight}`,
          children: {
            type: 'path',
            props: {
              d: `M ${strokeWidth} ${strokeWidth} L ${chevronWidth / 2} ${chevronHeight - strokeWidth} L ${chevronWidth - strokeWidth} ${strokeWidth}`,
              stroke: colors.gold,
              strokeWidth: strokeWidth,
              fill: 'none',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              opacity: 0.4
            }
          }
        }
      }
    }
  };
}

// Gold line at top (subtle accent)
function goldLineTop(colors, width) {
  const lineWidth = 2;
  const lineHeight = 100;
  const goldTransparent = 'rgba(197, 155, 61, 0)';

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 0,
        left: (width - lineWidth) / 2,
        width: lineWidth,
        height: lineHeight,
        background: `linear-gradient(180deg, ${colors.gold} 0%, ${colors.gold} 60%, ${goldTransparent} 100%)`,
        opacity: 0.8
      }
    }
  };
}

// =============================================================
// QUOTE SLIDE TEMPLATE
// =============================================================

function quoteSlide(text, colors, size) {
  const { width, height } = size;

  // Calculate font size based on dimensions and text length
  let fontSize;
  const textLength = text.length;

  if (width === 1080 && height === 1350) {
    // Instagram/Threads (portrait)
    fontSize = textLength > 100 ? 70 : textLength > 60 ? 85 : 100;
  } else if (width === 1200 && height === 1200) {
    // LinkedIn (square)
    fontSize = textLength > 100 ? 60 : textLength > 60 ? 75 : 90;
  } else {
    // Facebook (landscape)
    fontSize = textLength > 100 ? 50 : textLength > 60 ? 60 : 70;
  }

  return {
    type: 'div',
    props: {
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        padding: CONFIG.padding
      },
      children: [
        // Gold line at top
        goldLineTop(colors, width),

        // Quote text container
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              maxWidth: width - (CONFIG.padding * 2),
              marginTop: -40  // Shift up slightly to balance with chevron
            },
            children: {
              type: 'div',
              props: {
                style: {
                  fontSize: fontSize,
                  fontWeight: 700,
                  fontStyle: 'italic',
                  color: colors.text,
                  lineHeight: CONFIG.lineHeight,
                  textAlign: 'center'
                },
                children: text
              }
            }
          }
        },

        // Chevron below quote
        chevronDown(colors, width),

        // Handle (bottom-left)
        handleElement(colors)
      ]
    }
  };
}

// =============================================================
// MAIN HANDLER
// =============================================================

module.exports = async function handler(req, res) {
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
    const {
      theme = 'green',
      platform = 'instagram',
      data
    } = req.body;

    if (!data || !data.text) {
      return res.status(400).json({ error: 'Missing data.text (the quote)' });
    }

    const colors = CONFIG.themes[theme] || CONFIG.themes.green;
    const size = CONFIG.sizes[platform] || CONFIG.sizes.instagram;
    const { width, height } = size;

    const element = quoteSlide(data.text, colors, size);

    const fonts = await loadFont();

    const svg = await satori(element, {
      width,
      height,
      fonts
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width }
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(pngBuffer);

  } catch (error) {
    console.error('Error generating quote image:', error);
    return res.status(500).json({ error: error.message });
  }
};
