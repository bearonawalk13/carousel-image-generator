const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');

// =============================================================
// REEL THUMBNAIL CONFIGURATION (9:16 aspect ratio)
// =============================================================
const CONFIG = {
  width: 1080,
  height: 1920,

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
    dark: {
      background: '#0a1315',
      text: '#f5f3ef',
      gold: '#c59b3d'
    },
    black: {
      background: '#0a1315',
      text: '#f5f3ef',
      gold: '#c59b3d'
    }
  },

  sizes: {
    hookTitle: 110,  // Increased from 85 for better visibility
    hookSubtitle: 75
  },

  design: {
    goldLineWidth: 2,
    goldLineHeight: 160
  },

  // Instagram Reel safe zones (9:16 @ 1080x1920)
  // Top ~200px: username, follow button
  // Bottom ~470px: caption, likes, comments, share, audio
  // Right ~100px: engagement icons
  safeZone: {
    top: 200,
    bottom: 470,  // from bottom
    left: 50,
    right: 100,
    // Safe zone Y range: 200 to 1450 (height 1250)
    // Positions for text based on face location:
    // - "top": Face is below, put text in upper third -> Y ~350
    // - "middle": Face covers screen, put text centered -> Y ~825
    // - "bottom": Face is above, put text in lower third -> Y ~1200
    textPositions: {
      top: 400,      // Upper third of safe zone
      middle: 825,   // Center of safe zone
      bottom: 1150   // Lower third of safe zone
    },
    textCenterY: 825  // Default (legacy)
  },

  padding: 70,
  lineHeight: 1.3
};

// =============================================================
// FONT LOADING
// =============================================================
const FONT_OPTIONS = {
  cormorant: {
    name: 'Cormorant Garamond',
    urls: {
      regular: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_v86GnM.ttf',
      medium: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_s06GnM.ttf',
      bold: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_hg9GnM.ttf',
      italic: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jDOjw.ttf',
      mediumItalic: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd5wDDOjw.ttf',
      boldItalic: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd5FTfOjw.ttf'
    }
  }
};

async function loadFont(fontKey = 'cormorant') {
  const fontConfig = FONT_OPTIONS[fontKey] || FONT_OPTIONS.cormorant;
  const fontUrls = fontConfig.urls;
  const fontName = fontConfig.name;

  const hasMedium = fontUrls.medium && fontUrls.mediumItalic;

  const fetches = [
    fetch(fontUrls.regular).then(r => r.arrayBuffer()),
    fetch(fontUrls.bold).then(r => r.arrayBuffer()),
    fetch(fontUrls.italic).then(r => r.arrayBuffer()),
    fetch(fontUrls.boldItalic).then(r => r.arrayBuffer())
  ];

  if (hasMedium) {
    fetches.push(
      fetch(fontUrls.medium).then(r => r.arrayBuffer()),
      fetch(fontUrls.mediumItalic).then(r => r.arrayBuffer())
    );
  }

  const results = await Promise.all(fetches);
  const [regular, bold, italic, boldItalic] = results;

  const fonts = [
    { name: fontName, data: regular, weight: 400, style: 'normal' },
    { name: fontName, data: bold, weight: 700, style: 'normal' },
    { name: fontName, data: italic, weight: 400, style: 'italic' },
    { name: fontName, data: boldItalic, weight: 700, style: 'italic' }
  ];

  if (hasMedium) {
    fonts.push(
      { name: fontName, data: results[4], weight: 500, style: 'normal' },
      { name: fontName, data: results[5], weight: 500, style: 'italic' }
    );
  }

  return fonts;
}

// =============================================================
// REEL THUMBNAIL SLIDE
// =============================================================
function reelThumbnailSlide(data, colors, textPosition = 'middle') {
  const cfg = CONFIG;

  // Get text Y position based on face_position parameter
  // "top" = face is at bottom, so put text at top
  // "bottom" = face is at top, so put text at bottom
  // "middle" = face covers screen, put text in middle
  const textCenterY = cfg.safeZone.textPositions[textPosition] || cfg.safeZone.textPositions.middle;

  // Build hook text with gold highlighting
  let hookContent;

  if (data.text && data.highlight) {
    const highlightWord = data.highlight.toLowerCase();
    const words = data.text.split(' ');

    const wordElements = words.map((word, i) => {
      const wordLower = word.toLowerCase();
      const isHighlight = wordLower === highlightWord ||
                          wordLower.startsWith(highlightWord) ||
                          wordLower.endsWith(highlightWord);

      return {
        type: 'span',
        props: {
          style: {
            color: isHighlight ? colors.gold : colors.text,
            whiteSpace: 'pre'
          },
          children: i < words.length - 1 ? word + ' ' : word
        }
      };
    });

    hookContent = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'baseline',
          fontSize: cfg.sizes.hookTitle,
          fontWeight: 700,
          fontStyle: 'italic',
          lineHeight: cfg.lineHeight,
          maxWidth: 950,
          textAlign: 'center'
        },
        children: wordElements
      }
    };
  } else if (data.hook_line_1 || data.hook_line_2) {
    // Two-line format
    hookContent = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16
        },
        children: [
          data.hook_line_1 ? {
            type: 'div',
            props: {
              style: {
                fontSize: cfg.sizes.hookTitle,
                fontWeight: 700,
                fontStyle: 'italic',
                color: colors.text,
                lineHeight: cfg.lineHeight,
                textAlign: 'center'
              },
              children: data.hook_line_1
            }
          } : null,
          data.hook_line_2 ? {
            type: 'div',
            props: {
              style: {
                fontSize: cfg.sizes.hookTitle,
                fontWeight: 700,
                fontStyle: 'italic',
                color: colors.gold,
                lineHeight: cfg.lineHeight,
                textAlign: 'center'
              },
              children: data.hook_line_2
            }
          } : null
        ].filter(Boolean)
      }
    };
  }

  // Gold line at top
  const goldTransparent = 'rgba(197, 155, 61, 0)';
  const goldLineTop = {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 0,
        left: (cfg.width - cfg.design.goldLineWidth) / 2,
        width: cfg.design.goldLineWidth,
        height: cfg.design.goldLineHeight,
        background: `linear-gradient(180deg, ${colors.gold} 0%, ${colors.gold} 60%, ${goldTransparent} 100%)`,
        opacity: 0.8
      }
    }
  };

  // Gold line at bottom
  const goldLineBottom = {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: 0,
        left: (cfg.width - cfg.design.goldLineWidth) / 2,
        width: cfg.design.goldLineWidth,
        height: cfg.design.goldLineHeight,
        background: `linear-gradient(0deg, ${colors.gold} 0%, ${colors.gold} 60%, ${goldTransparent} 100%)`,
        opacity: 0.8
      }
    }
  };

  // Build the full slide
  // Note: Handle element removed - it's covered by Instagram's bottom UI anyway
  const children = [
    // Background image (if provided)
    data.background_image ? {
      type: 'img',
      props: {
        src: data.background_image,
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }
      }
    } : null,
    // Dark overlay for text readability
    {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: data.background_image
            ? 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.85) 100%)'
            : 'transparent'
        }
      }
    },
    // Solid background fallback (only if no background image)
    !data.background_image ? {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: colors.background
        }
      }
    } : null,
    // Gold lines (decorative - ok if partially covered by IG UI)
    goldLineTop,
    goldLineBottom,
    // Hook content (positioned in Instagram safe zone)
    {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          // Position text based on face position
          // paddingTop = textCenterY - estimatedTextHeight/2
          // For ~2 lines of text at 110px + line height, roughly 290px total
          paddingTop: textCenterY - 145,
          paddingLeft: cfg.safeZone.left,
          paddingRight: cfg.safeZone.right
        },
        children: hookContent
      }
    }
  ].filter(Boolean);

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        position: 'relative',
        width: cfg.width,
        height: cfg.height,
        overflow: 'hidden'
      },
      children
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
    const { theme = 'dark', data, font = 'cormorant', text_position = 'middle' } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const colors = CONFIG.themes[theme] || CONFIG.themes.dark;

    // text_position: "top" (face at bottom), "middle" (face covers), "bottom" (face at top)
    const element = reelThumbnailSlide(data, colors, text_position);
    const fonts = await loadFont(font);

    const svg = await satori(element, {
      width: CONFIG.width,
      height: CONFIG.height,
      fonts
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: CONFIG.width }
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(pngBuffer);

  } catch (error) {
    console.error('Error generating reel thumbnail:', error);
    return res.status(500).json({ error: error.message });
  }
};
