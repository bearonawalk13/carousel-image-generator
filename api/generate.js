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
    hookTitle: 112,      // Balanced for impact + readability
    bodyHeadline: 70,    // Increased for mobile readability
    bodyText: 60,        // Increased for mobile readability
    ctaTitle: 70,        // Increased for mobile readability
    ctaAction: 120,      // Increased for mobile readability
    ctaBody: 60          // Increased for mobile readability
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
// Font configurations for testing
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
  },
  lora: {
    name: 'Lora',
    urls: {
      regular: 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787weuyJG.ttf',
      bold: 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787z5vCJG.ttf',
      italic: 'https://fonts.gstatic.com/s/lora/v37/0QI8MX1D_JOuMw_hLdO6T2wV9KnW-MoFkqg.ttf',
      boldItalic: 'https://fonts.gstatic.com/s/lora/v37/0QI8MX1D_JOuMw_hLdO6T2wV9KnW-C0Ckqg.ttf'
    }
  },
  sourceSerif: {
    name: 'Source Serif 4',
    urls: {
      regular: 'https://fonts.gstatic.com/s/sourceserif4/v14/vEF02_tTDB4M7-auWDN0ahZJW1ge6NmXpVAHV83Bfb_US2D2QYxoUKIkn98pRl9dCw.ttf',
      bold: 'https://fonts.gstatic.com/s/sourceserif4/v14/vEF02_tTDB4M7-auWDN0ahZJW1ge6NmXpVAHV83Bfb_US2D2QYxoUKIkn98poVhdCw.ttf',
      italic: 'https://fonts.gstatic.com/s/sourceserif4/v14/vEFy2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6OAVIJmeUDygwjihdqrhw.ttf',
      boldItalic: 'https://fonts.gstatic.com/s/sourceserif4/v14/vEFy2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6OAVIJmeUDygwjivBtrhw.ttf'
    }
  }
};

async function loadFont(fontKey = 'cormorant') {
  const fontConfig = FONT_OPTIONS[fontKey] || FONT_OPTIONS.cormorant;
  const fontUrls = fontConfig.urls;
  const fontName = fontConfig.name;

  // Check if medium weights are available (only cormorant has them)
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
// TEXT STYLING PARSER
// =============================================================

// Parse markdown-style **bold** and *italic* markers in text
// Returns a wrapper element with inline styled spans (fixes line-break issues)
function parseStyledText(text, baseWeight = 500) {
  const segments = [];

  // Regex to match **bold** or *italic* (bold first to handle ** before *)
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      const plainText = text.slice(lastIndex, match.index);
      if (plainText) {
        segments.push({
          type: 'span',
          props: {
            style: {
              fontWeight: baseWeight,
              fontStyle: 'normal',
              whiteSpace: 'pre-wrap'  // Preserve spaces
            },
            children: plainText
          }
        });
      }
    }

    // Determine if bold (**) or italic (*)
    if (match[2]) {
      // Bold match (group 2)
      segments.push({
        type: 'span',
        props: {
          style: {
            fontWeight: 700,
            fontStyle: 'normal',
            whiteSpace: 'pre-wrap'  // Preserve spaces
          },
          children: match[2]
        }
      });
    } else if (match[3]) {
      // Italic match (group 3)
      segments.push({
        type: 'span',
        props: {
          style: {
            fontWeight: baseWeight,
            fontStyle: 'italic',
            whiteSpace: 'pre-wrap'  // Preserve spaces
          },
          children: match[3]
        }
      });
    }

    lastIndex = pattern.lastIndex;
  }

  // Add remaining plain text after last match
  if (lastIndex < text.length) {
    const plainText = text.slice(lastIndex);
    if (plainText) {
      segments.push({
        type: 'span',
        props: {
          style: {
            fontWeight: baseWeight,
            fontStyle: 'normal',
            whiteSpace: 'pre-wrap'  // Preserve spaces
          },
          children: plainText
        }
      });
    }
  }

  // If no styling found, return plain text string
  if (segments.length === 0) {
    return text;
  }

  // Return segments wrapped in a container that preserves inline flow
  return segments;
}

// =============================================================
// DESIGN ELEMENTS (matching preview_all_themes.html exactly)
// =============================================================

// Gold line at top (for hook slides) - centered using left calc
function goldLineTop(colors) {
  // Use gold at 0 opacity instead of 'transparent' to avoid color interpolation issues
  // CSS 'transparent' is rgba(0,0,0,0) which creates visual differences on light vs dark backgrounds
  const goldTransparent = 'rgba(197, 155, 61, 0)';
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 0,
        left: (CONFIG.width - CONFIG.design.goldLineWidth) / 2,
        width: CONFIG.design.goldLineWidth,
        height: CONFIG.design.goldLineHeight,
        background: `linear-gradient(180deg, ${colors.gold} 0%, ${colors.gold} 60%, ${goldTransparent} 100%)`,
        opacity: 0.8
      }
    }
  };
}

// Gold line at bottom (for CTA slides) - centered using left calc
function goldLineBottom(colors) {
  const goldTransparent = 'rgba(197, 155, 61, 0)';
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: 0,
        left: (CONFIG.width - CONFIG.design.goldLineWidth) / 2,
        width: CONFIG.design.goldLineWidth,
        height: CONFIG.design.goldLineHeight,
        background: `linear-gradient(0deg, ${colors.gold} 0%, ${colors.gold} 60%, ${goldTransparent} 100%)`,
        opacity: 0.8
      }
    }
  };
}

// Connecting line on right edge (fades from transparent to gold)
function connectLineRight(colors) {
  const goldTransparent = 'rgba(197, 155, 61, 0)';
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        right: 0,
        top: (CONFIG.height - CONFIG.design.connectLineHeight) / 2,
        width: CONFIG.design.connectLineRightWidth,
        height: CONFIG.design.connectLineHeight,
        background: `linear-gradient(90deg, ${goldTransparent} 0%, ${colors.gold} 100%)`,
        opacity: 0.6
      }
    }
  };
}

// Connecting line on left edge (fades from gold to transparent)
function connectLineLeft(colors) {
  const goldTransparent = 'rgba(197, 155, 61, 0)';
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        left: 0,
        top: (CONFIG.height - CONFIG.design.connectLineHeight) / 2,
        width: CONFIG.design.connectLineLeftWidth,
        height: CONFIG.design.connectLineHeight,
        background: `linear-gradient(90deg, ${colors.gold} 0%, ${goldTransparent} 100%)`,
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
        // Corner bracket bottom-left (tight to text, accounting for padding)
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
        // Corner bracket top-right (tight to text, accounting for padding)
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
        // Long arrow (dashes + arrow head)
        {
          type: 'div',
          props: {
            style: {
              fontSize: d.swipeFontSize,
              color: colors.text,
              lineHeight: 1,
              letterSpacing: -2
            },
            children: '———›'
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
  // Photo background mode: merged hook+body content on photo
  if (data.background_image) {
    const align = data.align || 'left';
    const alignItemsMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
    const overlayRgb = '0,0,0';  // Always black overlay for photo backgrounds
    // Always use light text on photo overlay
    const photoColors = { ...colors, text: '#f5f3ef' };

    // Build hook title text
    const hookText = data.text
      ? data.text
      : `${data.title_line_1 || ''} ${data.title_line_2 || ''}`.trim();

    // Determine sizes based on whether body content is merged
    const hasMergedBody = data.body_headline || (data.body_lines && data.body_lines.length > 0);
    const hookFontSize = hasMergedBody ? 80 : CONFIG.sizes.hookTitle;
    const bodyFontSize = data.font_size || 48;
    const headlineFontSize = data.headline_size || 56;

    // Build hook title element with optional highlight
    let hookTitleEl;
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
              color: isHighlight ? photoColors.gold : photoColors.text,
              whiteSpace: 'pre'
            },
            children: i < words.length - 1 ? word + ' ' : word
          }
        };
      });
      hookTitleEl = {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            fontSize: hookFontSize,
            fontWeight: 700,
            fontStyle: 'italic',
            lineHeight: CONFIG.lineHeight,
            maxWidth: 950
          },
          children: wordElements
        }
      };
    } else {
      hookTitleEl = hookText ? {
        type: 'div',
        props: {
          style: {
            fontSize: hookFontSize,
            fontWeight: 700,
            fontStyle: 'italic',
            color: photoColors.text,
            lineHeight: CONFIG.lineHeight,
            maxWidth: 950
          },
          children: hookText
        }
      } : null;
    }

    // Build merged body content (if provided)
    const bodyContent = [];
    if (data.body_headline) {
      bodyContent.push({
        type: 'div',
        props: {
          style: {
            fontSize: headlineFontSize,
            fontWeight: 700,
            color: photoColors.text,
            marginTop: 40,
            marginBottom: 20,
            lineHeight: CONFIG.lineHeight
          },
          children: data.body_headline
        }
      });
    }
    if (data.body_lines && data.body_lines.length > 0) {
      data.body_lines.forEach(line => {
        const styledContent = parseStyledText(line, 500);
        const hasMarkup = Array.isArray(styledContent);
        bodyContent.push({
          type: 'div',
          props: {
            style: {
              fontSize: bodyFontSize,
              fontWeight: 500,
              color: photoColors.text,
              marginBottom: 12,
              lineHeight: CONFIG.lineHeight,
              ...(hasMarkup ? { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline' } : {})
            },
            children: styledContent
          }
        });
      });
    }

    return {
      type: 'div',
      props: {
        style: {
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: alignItemsMap[align] || 'flex-start',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0a1315',
          padding: CONFIG.padding
        },
        children: [
          // Background image — photo visible through dark overlay
          {
            type: 'img',
            props: {
              src: data.background_image,
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: CONFIG.width,
                height: CONFIG.height,
                objectFit: 'cover',
                opacity: 0.45
              }
            }
          },
          // Dark overlay for text readability (photo still visible)
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: CONFIG.width,
                height: CONFIG.height,
                background: `linear-gradient(180deg, rgba(${overlayRgb},0.80) 0%, rgba(${overlayRgb},0.55) 30%, rgba(${overlayRgb},0.55) 70%, rgba(${overlayRgb},0.80) 100%)`
              }
            }
          },
          goldLineTop(photoColors),
          connectLineRight(photoColors),
          // Content container
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                paddingRight: 60,
                maxHeight: 1050,
                overflow: 'hidden'
              },
              children: [
                hookTitleEl,
                ...bodyContent
              ].filter(Boolean)
            }
          },
          handleElement(photoColors),
          swipeElement(photoColors)
        ]
      }
    };
  }

  // Build the title content based on format
  let titleContent;

  if (data.text && data.highlight) {
    // New format: single-word gold highlighting
    // Split text into words so flex wrapping happens at word boundaries
    const highlightWord = data.highlight.toLowerCase();
    const text = data.text;
    const words = text.split(' ');

    // Create a span for each word, highlighting the matching one
    const wordElements = words.map((word, i) => {
      // Check if this word contains the highlight (handles punctuation)
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
          // Add space after each word except the last
          children: i < words.length - 1 ? word + ' ' : word
        }
      };
    });

    // Support alignment option (default: center)
    const align = data.align || 'center';
    const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

    titleContent = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: justifyMap[align] || 'center',
          alignItems: 'baseline',
          fontSize: CONFIG.sizes.hookTitle,
          fontWeight: 700,
          fontStyle: 'italic',
          lineHeight: CONFIG.lineHeight,
          maxWidth: 950,
          textAlign: align
        },
        children: wordElements
      }
    };

    // Fallback if no words (shouldn't happen)
    if (wordElements.length === 0) {
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

  // Support slide-level alignment
  const align = data.align || 'center';
  const alignItemsMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

  return {
    type: 'div',
    props: {
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignItemsMap[align] || 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        padding: CONFIG.padding,
        textAlign: align
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
  // V2.1.0: Dynamic font sizing — accept optional font_size/headline_size from caller
  const bodyFontSize = data.font_size || CONFIG.sizes.bodyText;
  const headFontSize = data.headline_size || CONFIG.sizes.bodyHeadline;

  // Photo background overlay
  const hasPhoto = !!data.background_image;
  const overlayRgb = '0,0,0';  // Always black overlay for photo backgrounds
  // When photo + dark overlay, always use light text (white theme has dark text that won't read)
  const effectiveColors = hasPhoto
    ? { ...colors, text: '#f5f3ef' }
    : colors;

  // V2.1.0: Safe zone — content must not overflow into handle/swipe/slide-number areas
  // Top: slideNumberTop(60) + slideNumberSize(105) + 30px gap = 195px
  // Bottom: handleBottom(70) + ~50px handle height + 30px gap = 150px
  // Usable height: 1350 - 195 - 150 = 1005px
  const safeHeight = 1005;

  const bodyLines = (data.body_lines || []).map(line => {
    const styledContent = parseStyledText(line, 500);
    const hasMarkup = Array.isArray(styledContent);

    return {
      type: 'div',
      props: {
        style: {
          fontSize: bodyFontSize,
          fontWeight: 500,
          color: effectiveColors.text,
          marginBottom: 16,
          lineHeight: CONFIG.lineHeight,
          // Use flex with baseline alignment to fix text overlap issues
          ...(hasMarkup ? {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline'  // KEY: prevents vertical misalignment
          } : {})
        },
        children: styledContent
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
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: hasPhoto ? '#0a1315' : colors.background,
        padding: CONFIG.padding
      },
      children: [
        // Photo background — visible through dark overlay
        hasPhoto ? {
          type: 'img',
          props: {
            src: data.background_image,
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: CONFIG.width,
              height: CONFIG.height,
              objectFit: 'cover',
              opacity: 0.45
            }
          }
        } : null,
        // Dark overlay for text readability (photo still visible)
        hasPhoto ? {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: CONFIG.width,
              height: CONFIG.height,
              background: `linear-gradient(180deg, rgba(${overlayRgb},0.80) 0%, rgba(${overlayRgb},0.55) 30%, rgba(${overlayRgb},0.55) 70%, rgba(${overlayRgb},0.80) 100%)`
            }
          }
        } : null,
        slideNumber(slideNum, effectiveColors),
        connectLineLeft(effectiveColors),
        connectLineRight(effectiveColors),
        // Content container with safe zone enforcement
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingRight: 60,
              maxHeight: safeHeight,
              overflow: 'hidden'
            },
            children: [
              data.headline ? {
                type: 'div',
                props: {
                  style: {
                    fontSize: headFontSize,
                    fontWeight: 700,
                    color: effectiveColors.text,
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
        handleElement(effectiveColors),
        swipeElement(effectiveColors)
      ].filter(Boolean)
    }
  };
}

function ctaSlide(data, colors) {
  // Photo background overlay
  const hasPhoto = !!data.background_image;
  const overlayRgb = '0,0,0';  // Always black overlay for photo backgrounds
  // When photo + dark overlay, always use light text
  const effectiveColors = hasPhoto
    ? { ...colors, text: '#f5f3ef' }
    : colors;

  const lines = (data.lines || []).map(line => {
    let size = CONFIG.sizes.ctaBody;
    let color = effectiveColors.text;
    let weight = 500;  // Slightly bolder than 400 for better readability
    let marginTop = 0;
    let marginBottom = 24;

    if (line.style === 'title') {
      size = CONFIG.sizes.ctaTitle;
      weight = 600;
    } else if (line.style === 'action') {
      size = CONFIG.sizes.ctaAction;
      color = effectiveColors.gold;
      weight = 700;
      // Add extra spacing above and below action for emphasis
      marginTop = 40;
      marginBottom = 40;
    }

    return {
      type: 'div',
      props: {
        style: {
          fontSize: size,
          fontWeight: weight,
          color: color,
          marginTop: marginTop,
          marginBottom: marginBottom,
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
        backgroundColor: hasPhoto ? '#0a1315' : colors.background,
        padding: CONFIG.padding,
        textAlign: 'center'
      },
      children: [
        // Photo background — visible through dark overlay
        hasPhoto ? {
          type: 'img',
          props: {
            src: data.background_image,
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: CONFIG.width,
              height: CONFIG.height,
              objectFit: 'cover',
              opacity: 0.45
            }
          }
        } : null,
        // Dark overlay for text readability (photo still visible)
        hasPhoto ? {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: CONFIG.width,
              height: CONFIG.height,
              background: `linear-gradient(180deg, rgba(${overlayRgb},0.80) 0%, rgba(${overlayRgb},0.55) 30%, rgba(${overlayRgb},0.55) 70%, rgba(${overlayRgb},0.80) 100%)`
            }
          }
        } : null,
        // Design elements (always shown, including with photo backgrounds)
        connectLineLeft(effectiveColors),
        goldLineBottom(effectiveColors),
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
      ].filter(Boolean)
    }
  };
}

// =============================================================
// NOTE SLIDE (Personal Note: card on photo background)
// =============================================================

const PROFILE_PHOTO_URL = 'https://carousel-image-generator.vercel.app/profile-photo.jpg';
const PROFILE_NAME = 'Bastian Gugger';
const PROFILE_HANDLE = '@bastiangugger';

function noteSlide(data, colors) {
  // data: { background_image, text (string or array), is_cta (bool) }
  const cardBg = '#ffffff';
  const cardText = '#1a1a1a';
  const cardSubtext = '#666666';
  const profileUrl = data.profile_photo || PROFILE_PHOTO_URL;

  // Build text lines from either string or array
  const textContent = Array.isArray(data.text)
    ? data.text
    : [data.text || ''];

  const textElements = textContent.map(line => {
    const styledContent = parseStyledText(line, 400);
    const hasMarkup = Array.isArray(styledContent);
    return {
      type: 'div',
      props: {
        style: {
          fontSize: 42,
          fontWeight: 400,
          color: cardText,
          lineHeight: 1.5,
          marginBottom: 8,
          ...(hasMarkup ? { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline' } : {})
        },
        children: styledContent
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
        backgroundColor: '#000000'
      },
      children: [
        // Background image — full photo, no opacity reduction
        data.background_image ? {
          type: 'img',
          props: {
            src: data.background_image,
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: CONFIG.width,
              height: CONFIG.height,
              objectFit: 'cover'
            }
          }
        } : null,
        // Gold line top
        goldLineTop({ ...colors, gold: colors.gold }),
        // Gold line bottom
        goldLineBottom({ ...colors, gold: colors.gold }),
        // White card — centered on photo
        {
          type: 'div',
          props: {
            style: {
              position: 'relative',
              backgroundColor: cardBg,
              borderRadius: 30,
              padding: '45px 50px',
              maxWidth: 750,
              width: 750,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column'
            },
            children: [
              // Profile header: photo + name + handle
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 35
                  },
                  children: [
                    // Profile photo circle
                    {
                      type: 'img',
                      props: {
                        src: profileUrl,
                        style: {
                          width: 90,
                          height: 90,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          marginRight: 25
                        }
                      }
                    },
                    // Name + handle
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column'
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: 38,
                                fontWeight: 600,
                                color: cardText,
                                lineHeight: 1.2
                              },
                              children: data.profile_name || PROFILE_NAME
                            }
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: 30,
                                fontWeight: 400,
                                color: cardSubtext,
                                lineHeight: 1.3
                              },
                              children: data.profile_handle || PROFILE_HANDLE
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              // Text content
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column'
                  },
                  children: textElements
                }
              }
            ]
          }
        }
      ].filter(Boolean)
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
    const { type, theme = 'green', data, slide_number = 2, font = 'cormorant' } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' });
    }

    const colors = CONFIG.themes[theme] || CONFIG.themes.green;

    let element;
    let width = CONFIG.width;
    let height = CONFIG.height;

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
      case 'note':
        element = noteSlide(data, colors);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type. Use: hook, body, cta, or note' });
    }

    const fonts = await loadFont(font);

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
    console.error('Error generating image:', error);
    return res.status(500).json({ error: error.message });
  }
};
