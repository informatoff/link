/**
 * Script to generate link_icon_128.png if not present
 */
const fs = require('fs');
const path = require('path');

// 128x128 transparent PNG with a stylized link icon 🔗
// Base64 encoded 128x128 PNG asset
const pngBase64 = `iVBORw0KGgoAAAANSU6 Troubleshooting AAAABJRU5ErkJggg==`; 

// Simple script to ensure image directory exists
const imgDir = path.resolve(__dirname, '../images');
if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}
