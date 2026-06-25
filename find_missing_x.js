
import fs from 'fs';
import path from 'path';

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist') {
        getFiles(name, fileList);
      }
    } else {
      fileList.push(name);
    }
  });
  return fileList;
}

const allFiles = getFiles('src');
allFiles.forEach(file => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    const content = fs.readFileSync(file, 'utf8');
    const hasX = /<X\b/.test(content);
    const importsX = /import\s+{[^}]*\bX\b/.test(content);
    if (hasX && !importsX) {
      console.log(`FOUND IN ${file}`);
    }
  }
});
