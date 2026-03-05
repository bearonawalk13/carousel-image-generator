const sharp = require('sharp');

// Resize/crop photos to carousel dimensions (1080x1350)
// Used by Photo Dump: raw photos posted as carousel slides without text/overlay

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
    const { image_url, width = 1080, height = 1350 } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: 'Missing image_url' });
    }

    // Fetch the image
    const response = await fetch(image_url);
    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch image: ${response.status}` });
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Resize and crop to target dimensions (cover mode = fill + crop)
    const outputBuffer = await sharp(imageBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'centre'
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(outputBuffer);

  } catch (error) {
    console.error('Error resizing image:', error);
    return res.status(500).json({ error: error.message });
  }
};
