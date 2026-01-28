const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');

// =============================================================
// CONFIGURATION
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
// DESIGN ELEMENTS
// =============================================================

// Gold line at top (for hook slides)
function goldLineTop(colors) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 2,
        height: 120,
        background: `linear-gradient(180deg, ${colors.gold} 0%, ${colors.gold} 60%, transparent 100%)`,
        opacity: 0.8
      }
    }
  };
}

// Gold line at bottom (for CTA slides)
function goldLineBottom(colors) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 2,
        height: 120,
        background: `linear-gradient(0deg, ${colors.gold} 0%, ${colors.gold} 60%, transparent 100%)`,
        opacity: 0.8
      }
    }
  };
}

// Handle with corner brackets
function handleElement(colors) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: 70,
        left: 70,
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
              bottom: -4,
              left: -8,
              width: 12,
              height: 12,
              borderLeft: `1px solid ${colors.gold}`,
              borderBottom: `1px solid ${colors.gold}`,
              opacity: 0.4
            }
          }
        },
        // Handle text
        {
          type: 'div',
          props: {
            style: {
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: colors.text,
              opacity: 0.55
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
              top: -4,
              right: -8,
              width: 12,
              height: 12,
              borderRight: `1px solid ${colors.gold}`,
              borderTop: `1px solid ${colors.gold}`,
              opacity: 0.4
            }
          }
        }
      ]
    }
  };
}

// Swipe indicator with arrow
function swipeElement(colors) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: 70,
        right: 70,
        display: 'flex',
        alignItems: 'center',
        gap: 16
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: colors.text,
              opacity: 0.55
            },
            children: 'SWIPE'
          }
        },
        // Arrow line with head
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center'
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: 45,
                    height: 1,
                    backgroundColor: colors.text,
                    opacity: 0.55
                  }
                }
              },
              {
                type: 'div',
                props: {
                  style: {
                    width: 0,
                    height: 0,
                    borderTop: '5px solid transparent',
                    borderBottom: '5px solid transparent',
                    borderLeft: `8px solid ${colors.text}`,
                    opacity: 0.55,
                    marginLeft: -1
                  }
                }
              }
            ]
          }
        }
      ]
    }
  };
}

// Slide number circle
function slideNumber(num, colors) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 60,
        right: 60,
        width: 90,
        height: 90,
        borderRadius: '50%',
        border: `1px solid ${colors.text}`,
        opacity: 0.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      children: {
        type: 'div',
        props: {
          style: {
            fontSize: 40,
            fontWeight: 400,
            color: colors.text,
            opacity: 1
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
        // Content container
        {
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
        },
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
