import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0e15"/>
      <stop offset="100%" stop-color="#14172a"/>
    </linearGradient>
    <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8b9bff"/>
      <stop offset="100%" stop-color="#bd93f9"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <path d="M82 28a46 46 0 1 0 18 75 38 38 0 0 1-18-75z" fill="url(#moon)"/>
</svg>`;

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const buf = await sharp(Buffer.from(SVG)).resize(size, size).png().toBuffer();
  writeFileSync(`public/icons/icon-${size}.png`, buf);
  console.log(`wrote public/icons/icon-${size}.png`);
}
