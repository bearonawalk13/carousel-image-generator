const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');

// =============================================================
// REVIEW CARD GENERATOR — Brand-agnostic Google Review cards
// =============================================================
// POST /api/review-card
// {
//   data: {
//     name: "Markus Beerli",
//     stars: 5,
//     text: "Review text here...",
//     date: "vor 1 Jahr",
//     photo_url: "https://...",         // optional reviewer photo
//     subtitle: "2 Rezensionen",        // optional (e.g. "Lokaler Reiseführer · 6 Rezensionen")
//   },
//   width: 480,       // optional, default 480
//   scale: 2          // optional, default 2 (retina)
// }

const CONFIG = {
  defaultWidth: 480,
  defaultScale: 2,
  padding: 16,
  cardBg: '#ffffff',
  cardBorder: '#e0e0e0',
  nameColor: '#1a1a1a',
  metaColor: '#70757a',
  textColor: '#3c4043',
  starFilled: '#fbbc04',
  starEmpty: '#e0e0e0',
  avatarBg: '#4285f4',
  avatarSize: 40,
  borderRadius: 8,
};

// Roboto font via jsDelivr (reliable CDN, serves WOFF which satori supports)
const FONT_URLS = {
  regular: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-400-normal.woff',
  medium: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-500-normal.woff',
};

async function loadFonts() {
  const [regular, medium] = await Promise.all([
    fetch(FONT_URLS.regular).then(r => r.arrayBuffer()),
    fetch(FONT_URLS.medium).then(r => r.arrayBuffer()),
  ]);
  return [
    { name: 'Roboto', data: regular, weight: 400, style: 'normal' },
    { name: 'Roboto', data: medium, weight: 500, style: 'normal' },
  ];
}

async function fetchPhoto(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    const base64 = Buffer.from(buf).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

function starsSvgPath() {
  return 'M9 1.5l2.47 5.01L17 7.34l-4 3.9.94 5.51L9 14.08l-4.94 2.67.94-5.51-4-3.9 5.53-.83z';
}

function buildStars(count) {
  const stars = [];
  for (let i = 0; i < 5; i++) {
    stars.push({
      type: 'svg',
      props: {
        viewBox: '0 0 18 18',
        width: 14,
        height: 14,
        style: { display: 'flex' },
        children: [{
          type: 'path',
          props: {
            d: starsSvgPath(),
            fill: i < count ? CONFIG.starFilled : CONFIG.starEmpty,
          }
        }]
      }
    });
  }
  return stars;
}

// Google logo as SVG paths
function googleLogo() {
  const paths = [
    { d: 'M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z', fill: '#EA4335' },
    { d: 'M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z', fill: '#FBBC05' },
    { d: 'M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z', fill: '#4285F4' },
    { d: 'M225 3v65h-9.5V3h9.5z', fill: '#34A853' },
    { d: 'M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z', fill: '#EA4335' },
    { d: 'M35.29 41.19V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49-.01z', fill: '#4285F4' },
  ];

  return {
    type: 'svg',
    props: {
      viewBox: '0 0 272 92',
      width: 54,
      height: 18,
      children: paths.map(p => ({
        type: 'path',
        props: { d: p.d, fill: p.fill }
      }))
    }
  };
}

function buildCard(data, photoData) {
  const { name, stars, text, date, subtitle } = data;
  const avatarLeft = 52; // 40px avatar + 12px gap

  // Avatar element
  const avatar = photoData
    ? {
        type: 'img',
        props: {
          src: photoData,
          width: CONFIG.avatarSize,
          height: CONFIG.avatarSize,
          style: {
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
          }
        }
      }
    : {
        type: 'div',
        props: {
          style: {
            width: CONFIG.avatarSize,
            height: CONFIG.avatarSize,
            borderRadius: '50%',
            backgroundColor: CONFIG.avatarBg,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: 18,
            fontWeight: 500,
          },
          children: name ? name.charAt(0).toUpperCase() : '?'
        }
      };

  // Subtitle (e.g. "Lokaler Reiseführer · 6 Rezensionen")
  const subtitleEl = subtitle ? {
    type: 'div',
    props: {
      style: { fontSize: 12, color: CONFIG.metaColor, lineHeight: '16px' },
      children: subtitle
    }
  } : null;

  // Stars row
  const starsRow = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        marginLeft: avatarLeft,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: 0 },
            children: buildStars(stars || 5)
          }
        },
        date ? {
          type: 'span',
          props: {
            style: { fontSize: 12, color: CONFIG.metaColor, lineHeight: '16px' },
            children: date
          }
        } : null
      ].filter(Boolean)
    }
  };

  // Review text — split on newlines
  const textLines = (text || '').split('\n').filter(l => l.trim());
  const reviewText = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        fontSize: 14,
        color: CONFIG.textColor,
        lineHeight: '21px',
        marginLeft: avatarLeft,
        wordWrap: 'break-word',
      },
      children: textLines.map((line, i) => ({
        type: 'div',
        props: {
          style: { display: 'flex', marginBottom: i < textLines.length - 1 ? 4 : 0 },
          children: line
        }
      }))
    }
  };

  // Google logo
  const logoRow = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 12,
      },
      children: [googleLogo()]
    }
  };

  // Full card
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: CONFIG.cardBg,
        padding: CONFIG.padding,
        borderRadius: CONFIG.borderRadius,
        border: `1px solid ${CONFIG.cardBorder}`,
      },
      children: [
        // Header: avatar + name + subtitle
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 8,
            },
            children: [
              avatar,
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', gap: 1 },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: 14, fontWeight: 500, color: CONFIG.nameColor, lineHeight: '20px' },
                        children: name || 'Anonymous'
                      }
                    },
                    subtitleEl
                  ].filter(Boolean)
                }
              }
            ]
          }
        },
        starsRow,
        reviewText,
        logoRow,
      ]
    }
  };
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { data, width, scale } = req.body;

    if (!data || !data.name) {
      return res.status(400).json({ error: 'data.name is required' });
    }

    const cardWidth = width || CONFIG.defaultWidth;
    const cardScale = scale || CONFIG.defaultScale;
    const renderWidth = cardWidth * cardScale;

    // Load font + photo in parallel
    const [fonts, photoData] = await Promise.all([
      loadFonts(),
      fetchPhoto(data.photo_url),
    ]);

    // Build the card element
    const element = buildCard(data, photoData);

    // Render with Satori
    const svg = await satori(element, {
      width: renderWidth,
      fonts,
    });

    // Convert SVG to PNG with Resvg
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: renderWidth },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="review-card.png"');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(pngBuffer));

  } catch (err) {
    console.error('Review card error:', err);
    return res.status(500).json({ error: err.message });
  }
};
