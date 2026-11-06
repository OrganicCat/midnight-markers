import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });

const ART = `
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
  <path d="M82 28a46 46 0 1 0 18 75 38 38 0 0 1-18-75z" fill="url(#moon)"/>`;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${ART}
</svg>`;

/**
 * The "already saved" badge: a dark "B" on a teal square in the top-right
 * corner, like an exponent. It's drawn on a 16-unit grid (one unit is one
 * pixel in the 16px toolbar icon) so the letter lands on whole pixels and
 * stays readable at that size. A font-rendered B blurs into a smudge there.
 */
const B_ROWS = ['XXX.', 'X..X', 'XXX.', 'X..X', 'X..X', 'XXX.'];
const B_PIXELS = B_ROWS.flatMap((row, y) =>
  [...row].map((c, x) => (c === 'X' ? `<rect x="${10 + x}" y="${1 + y}" width="1" height="1"/>` : '')),
).join('');

const SAVED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${ART}
  <g transform="scale(8)" shape-rendering="crispEdges">
    <path d="M7 0h9v9h-9z" fill="#0d0e15"/>
    <rect x="8" y="0" width="8" height="8" rx="1.5" fill="#6fe6cf" shape-rendering="geometricPrecision"/>
    <g fill="#0d0e15">${B_PIXELS}</g>
  </g>
</svg>`;

async function write(svg, name, sizes) {
  for (const size of sizes) {
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    writeFileSync(`public/icons/${name}-${size}.png`, buf);
    console.log(`wrote public/icons/${name}-${size}.png`);
  }
}

await write(SVG, 'icon', [16, 32, 48, 128]);
// Toolbar-only, so just the two sizes browsers draw the action icon at.
await write(SAVED_SVG, 'icon-saved', [16, 32]);
