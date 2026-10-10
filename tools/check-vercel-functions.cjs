const fs = require('node:fs');
const path = require('node:path');

function entrypoints(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) return [];
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return entrypoints(path.join(directory, entry.name), relative);
    return !entry.name.endsWith('.d.ts') && /\.(?:[cm]?js|tsx?|jsx|py|go|rb|rs)$/.test(entry.name) ? [relative] : [];
  }).sort();
}

module.exports = { entrypoints };
if (require.main === module) {
  const functions = entrypoints(path.join(__dirname, '..', 'api'));
  if (functions.length > 12) {
    console.error(`Vercel Hobby supports 12 functions; found ${functions.length}:\n${functions.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Vercel Hobby function budget: ${functions.length}/12.`);
  }
}
