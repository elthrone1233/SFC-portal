const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const devHtml = path.join(rootDir, 'index.html.dev');
const rootHtml = path.join(rootDir, 'index.html');

if (!fs.existsSync(rootHtml) && fs.existsSync(devHtml)) {
  console.log('[Setup] Restored index.html from index.html.dev backup for compilation / development.');
  fs.copyFileSync(devHtml, rootHtml);
} else {
  console.log('[Setup] Root index.html check passed.');
}
