const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);
const javascriptFiles = [];
const htmlFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      javascriptFiles.push(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(fullPath);
    }
  }
}

function checkJavaScript() {
  for (const file of javascriptFiles) {
    const source = fs.readFileSync(file, 'utf8');
    new vm.Script(source, { filename: file });
  }
}

function checkHtmlReferences() {
  const missing = [];
  const referencePattern = /\b(?:href|src)="([^"]+)"/g;

  for (const file of htmlFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(referencePattern)) {
      const reference = match[1];
      if (
        !reference ||
        reference.startsWith('#') ||
        reference.startsWith('http://') ||
        reference.startsWith('https://') ||
        reference.startsWith('mailto:') ||
        reference.startsWith('tel:')
      ) {
        continue;
      }

      const target = path.resolve(path.dirname(file), reference.split(/[?#]/)[0]);
      if (!fs.existsSync(target)) {
        missing.push(`${path.relative(root, file)} -> ${reference}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing local HTML references:\n${missing.join('\n')}`);
  }
}

function checkDeploymentUrls() {
  const hardCodedLocalhost = javascriptFiles.filter((file) =>
    fs.readFileSync(file, 'utf8').includes('http://localhost')
  );

  if (hardCodedLocalhost.length > 0) {
    throw new Error(
      `Hard-coded localhost API URLs found:\n${hardCodedLocalhost
        .map((file) => path.relative(root, file))
        .join('\n')}`
    );
  }
}

walk(root);
checkJavaScript();
checkHtmlReferences();
checkDeploymentUrls();

console.log(`Validated ${javascriptFiles.length} JavaScript files and ${htmlFiles.length} HTML files.`);
