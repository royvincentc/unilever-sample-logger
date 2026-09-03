const { readFileSync } = require('fs');
const code = readFileSync('src/utils/enviSorting.ts', 'utf8');
const match = code.match(/export const ENVI_SAMPLE_ORDER = \[(.*?)\];/s);
if (match) {
  const arr = eval('[' + match[1] + ']');
  console.log("Array length:", arr.length);
  function clean(s) {
    if (!s) return '';
    return s.trim().toUpperCase().replace(/\s+/g, ' ');
  }
  const cleanName = clean("Main Mixing Tank 1 - Sampling Port 1");
  const index = arr.findIndex(n => clean(n) === cleanName);
  console.log("Index:", index);
}
