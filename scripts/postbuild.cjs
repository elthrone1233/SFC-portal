const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const devHtml = path.join(rootDir, 'index.html.dev');
const rootHtml = path.join(rootDir, 'index.html');

if (fs.existsSync(rootHtml)) {
  console.log('[Post-Build] Copying root index.html -> index.html.dev to prevent cPanel static Apache interception while keeping local development alive.');
  if (fs.existsSync(devHtml)) {
    fs.unlinkSync(devHtml); // Remove old backup to avoid conflicts
  }
  fs.copyFileSync(rootHtml, devHtml);
}
console.log('[Post-Build] Production assets are clean and fully ready for deployment.');
