// Generate PWA icons using sharp
// Run with: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const createSVG = (size) => {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${Math.floor(size * 0.1875)}" fill="#09090b"/>
    <text x="${size/2}" y="${size * 0.625}" font-family="system-ui, -apple-system, sans-serif" font-size="${Math.floor(size * 0.546875)}" font-weight="700" fill="white" text-anchor="middle">M</text>
  </svg>`);
};

async function generateIcons() {
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');

  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const sizes = [192, 512];

  for (const size of sizes) {
    const svg = createSVG(size);
    await sharp(svg)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Generate Apple touch icon (180x180)
  const appleSvg = createSVG(180);
  await sharp(appleSvg)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  console.log('\nDone! Icons generated successfully.');
}

generateIcons().catch(console.error);
