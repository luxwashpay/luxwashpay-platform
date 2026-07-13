import sharp from "sharp";
import { writeFileSync } from "fs";

const svg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#07090f"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="central"
    font-family="sans-serif" font-weight="800" font-size="${size * 0.3}" fill="#f59e0b">
    DN
  </text>
</svg>`;

const maskableSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#07090f"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="central"
    font-family="sans-serif" font-weight="800" font-size="${size * 0.25}" fill="#f59e0b">
    DN
  </text>
</svg>`;

async function generate() {
  await sharp(Buffer.from(svg(192))).png().toFile("public/icons/icon-192x192.png");
  await sharp(Buffer.from(svg(512))).png().toFile("public/icons/icon-512x512.png");
  await sharp(Buffer.from(maskableSvg(512))).png().toFile("public/icons/icon-512x512-maskable.png");
  await sharp(Buffer.from(svg(180))).png().toFile("public/icons/apple-touch-icon.png");
  console.log("Icons generated!");
}

generate();
