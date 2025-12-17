// Generate a simple icon for JSPad
import { writeFileSync } from 'fs';

// Create a simple 1024x1024 PNG with "JS" text
// This is a minimal valid PNG file with a gradient background
const width = 1024;
const height = 1024;

// We'll use a simple approach: create an SVG and convert it
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad)" rx="180"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="480" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">JS</text>
</svg>`;

writeFileSync('app-icon.svg', svg);
console.log('✅ SVG icon created: app-icon.svg');
console.log('Now run: bunx @tauri-apps/cli icon app-icon.svg');
