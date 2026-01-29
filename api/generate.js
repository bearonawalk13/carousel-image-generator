const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');

// =============================================================
// CONFIGURATION (scaled from 20% preview to 1080x1350)
// =============================================================
const CONFIG = {
  width: 1080,
  height: 1350,
  handle: 'BASTIANGUGGER',

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

  sizes: {
    hookTitle: 72,
    bodyHeadline: 56,
    bodyText: 48,
    ctaTitle: 56,
    ctaAction: 72,
    ctaBody: 48
  },

  // Design element sizes (scaled 5x from 20% preview)
  design: {
    goldLineWidth: 2,
    goldLineHeight: 120,
    handleBottom: 70,
    handleLeft: 70,
    handleFontSize: 30,
    handleLetterSpacing: 6,
    cornerSize: 15,
    swipeBottom: 70,
    swipeRight: 70,
    swipeFontSize: 30,
    swipeLetterSpacing: 6,
    swipeGap: 20,
    arrowLineWidth: 55,
    arrowLineHeight: 1,
    arrowChevronSize: 15,
    slideNumberTop: 60,
    slideNumberRight: 60,
    slideNumberSize: 105,
    slideNumberFontSize: 45,
    connectLineRightWidth: 110,
    connectLineLeftWidth: 70,
    connectLineHeight: 2
  },

  padding: 80,
  lineHeight: 1.4,
  headlineBodyGap: 40
};

// =============================================================
// FONT LOADING
// =============================================================
async function loadFont() {
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
// DESIGN ELEMENTS (matching preview_all_themes.html exactly)
// =============================================================

// Gold line at top (for hook slides) - centered using left calc
function goldLineTop(colors) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 0,
        left: (CONFIG.width - CONFIG.design.goldLineWidth) / 2,
        width: CONFIG.design.goldLineWidth,
        height: CONFIG.design.goldLineHeight,
        background: `linear-gradient(180deg, ${colors.gold} 0%, ${colors.gold} 60%, transparent 100%)`,
        opacity: 0.8
      }
    }
  };
}

// Gold line at bottom (for CTA slides) - centered using left calc
function goldLineBottom(colors) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: 0,
        left: (CONFIG.width - CONFIG.design.goldLineWidth) / 2,
        width: CONFIG.design.goldLineWidth,
        height: CONFIG.design.goldLineHeight,
        background: `linear-gradient(0deg, ${colors.gold} 0%, ${colors.gold} 60%, transparent 100%)`,
        opacity: 0.8
      }
    }
  };
}

// Connecting line on right edge (fades from transparent to gold)
function connectLineRight(colors) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        right: 0,
        top: (CONFIG.height - CONFIG.design.connectLineHeight) / 2,
        width: CONFIG.design.connectLineRightWidth,
        height: CONFIG.design.connectLineHeight,
        background: `linear-gradient(90deg, transparent 0%, ${colors.gold} 100%)`,
        opacity: 0.6
      }
    }
  };
}

// Connecting line on left edge (fades from gold to transparent)
function connectLineLeft(colors) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        left: 0,
        top: (CONFIG.height - CONFIG.design.connectLineHeight) / 2,
        width: CONFIG.design.connectLineLeftWidth,
        height: CONFIG.design.connectLineHeight,
        background: `linear-gradient(90deg, ${colors.gold} 0%, transparent 100%)`,
        opacity: 0.6
      }
    }
  };
}

// Handle with corner brackets
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
        // Corner bracket bottom-left (very tight to text)
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: 0,
              left: 0,
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
        // Corner bracket top-right (very tight to text)
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              right: 0,
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

// Swipe indicator with arrow
function swipeElement(colors) {
  const d = CONFIG.design;
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: d.swipeBottom,
        right: d.swipeRight,
        display: 'flex',
        alignItems: 'center',
        gap: d.swipeGap,
        opacity: 0.7
      },
      children: [
        // SWIPE text
        {
          type: 'div',
          props: {
            style: {
              fontSize: d.swipeFontSize,
              fontWeight: 500,
              letterSpacing: d.swipeLetterSpacing,
              textTransform: 'uppercase',
              color: colors.text
            },
            children: 'SWIPE'
          }
        },
        // Long arrow (line + arrow head)
        {
          type: 'div',
          props: {
            style: {
              fontSize: d.swipeFontSize + 4,
              color: colors.text,
              lineHeight: 1
            },
            children: '⟶'
          }
        }
      ]
    }
  };
}

// Slide number circle - border has opacity, number is visible
function slideNumber(num, colors) {
  const d = CONFIG.design;
  // Create rgba border color with 35% opacity (slightly more visible)
  const borderColor = colors.text === '#f5f3ef'
    ? 'rgba(245, 243, 239, 0.35)'
    : 'rgba(12, 31, 26, 0.35)';

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: d.slideNumberTop,
        right: d.slideNumberRight,
        width: d.slideNumberSize,
        height: d.slideNumberSize,
        borderRadius: '50%',
        border: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      children: {
        type: 'div',
        props: {
          style: {
            fontSize: d.slideNumberFontSize,
            fontWeight: 400,
            color: colors.text,
            opacity: 0.7,
            paddingBottom: 5
          },
          children: String(num)
        }
      }
    }
  };
}

// =============================================================
// SLIDE TEMPLATES
// =============================================================

function hookSlide(data, colors) {
  // Build the title content based on format
  let titleContent;

  if (data.text && data.highlight) {
    // New format: single-word gold highlighting
    // Split text around the highlight word
    const highlightWord = data.highlight;
    const text = data.text;
    const highlightIndex = text.toLowerCase().indexOf(highlightWord.toLowerCase());

    if (highlightIndex !== -1) {
      const before = text.slice(0, highlightIndex);
      const highlighted = text.slice(highlightIndex, highlightIndex + highlightWord.length);
      const after = text.slice(highlightIndex + highlightWord.length);

      // Create inline text with highlighted word - must use flexWrap for multi-word lines
      titleContent = {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'baseline',
            fontSize: CONFIG.sizes.hookTitle,
            fontWeight: 700,
            fontStyle: 'italic',
            lineHeight: CONFIG.lineHeight,
            maxWidth: 900,
            textAlign: 'center'
          },
          children: [
            before ? {
              type: 'span',
              props: {
                style: { color: colors.text, whiteSpace: 'pre-wrap' },
                children: before
              }
            } : null,
            {
              type: 'span',
              props: {
                style: { color: colors.gold, whiteSpace: 'pre-wrap' },
                children: highlighted
              }
            },
            after ? {
              type: 'span',
              props: {
                style: { color: colors.text, whiteSpace: 'pre-wrap' },
                children: after
              }
            } : null
          ].filter(Boolean)
        }
      };
    } else {
      // Highlight word not found, render as plain text
      titleContent = {
        type: 'div',
        props: {
          style: {
            fontSize: CONFIG.sizes.hookTitle,
            fontWeight: 700,
            fontStyle: 'italic',
            color: colors.text,
            lineHeight: CONFIG.lineHeight,
            maxWidth: 900,
            textAlign: 'center'
          },
          children: text
        }
      };
    }
  } else {
    // Legacy format: title_line_1 (white) + title_line_2 (gold)
    titleContent = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
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
        padding: CONFIG.padding,
        textAlign: 'center'
      },
      children: [
        goldLineTop(colors),
        connectLineRight(colors),
        // Content container
        titleContent,
        handleElement(colors),
        swipeElement(colors)
      ]
    }
  };
}

function bodySlide(data, colors, slideNum) {
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
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        padding: CONFIG.padding
      },
      children: [
        slideNumber(slideNum, colors),
        connectLineLeft(colors),
        connectLineRight(colors),
        // Content container
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingRight: 60
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
        },
        handleElement(colors),
        swipeElement(colors)
      ]
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
        position: 'relative',
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
      children: [
        connectLineLeft(colors),
        goldLineBottom(colors),
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            },
            children: lines
          }
        }
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
    const { type, theme = 'green', data, slide_number = 2 } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' });
    }

    const colors = CONFIG.themes[theme] || CONFIG.themes.green;

    let element;
    switch (type) {
      case 'hook':
        element = hookSlide(data, colors);
        break;
      case 'body':
        element = bodySlide(data, colors, slide_number);
        break;
      case 'cta':
        element = ctaSlide(data, colors);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type. Use: hook, body, or cta' });
    }

    const fonts = await loadFont();

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
    console.error('Error generating image:', error);
    return res.status(500).json({ error: error.message });
  }
};
