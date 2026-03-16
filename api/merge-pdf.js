// Merge multiple PNG images into a single PDF document
// Used for LinkedIn carousel uploads (LinkedIn requires PDF format)
const { PDFDocument } = require('pdf-lib');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image_urls } = req.body;

    if (!image_urls || !Array.isArray(image_urls) || image_urls.length === 0)
      return res.status(400).json({ error: 'Missing or empty image_urls array' });

    if (image_urls.length > 20)
      return res.status(400).json({ error: 'Maximum 20 images allowed' });

    const pdfDoc = await PDFDocument.create();

    for (const url of image_urls) {
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch image: ${url} (${response.status})` });
      }

      const imageBytes = await response.arrayBuffer();
      const uint8 = new Uint8Array(imageBytes);

      // Detect format from first bytes
      let image;
      if (uint8[0] === 0x89 && uint8[1] === 0x50) {
        image = await pdfDoc.embedPng(imageBytes);
      } else if (uint8[0] === 0xFF && uint8[1] === 0xD8) {
        image = await pdfDoc.embedJpg(imageBytes);
      } else {
        return res.status(400).json({ error: `Unsupported image format for: ${url}` });
      }

      // Page size matches image dimensions (1080x1350 for carousels)
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="carousel.pdf"');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error merging PDF:', error);
    return res.status(500).json({ error: error.message });
  }
};
