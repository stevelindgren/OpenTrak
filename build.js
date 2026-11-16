// Builds dist/opentrak.html: one self-contained file (app + CPM engine + jsPDF), no network access needed.
'use strict';
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const app = read('src/app.html');
const engine = read('src/engine.js');
const jspdf = read('node_modules/jspdf/dist/jspdf.umd.min.js').replace(/\/\/# sourceMappingURL=.*$/m, '');
if (/<\/script/i.test(engine + jspdf)) throw new Error('Refusing to inline a script containing </script>');

// IBM Plex Sans (SIL Open Font License 1.1), embedded so the app works offline
const fontDir = 'node_modules/@fontsource/ibm-plex-sans/files/';
const fonts = '/* IBM Plex Sans — SIL OFL 1.1 — (c) IBM Corp. */\n' + [400, 500, 600].map((w) =>
  "@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:" + w + ";font-display:swap;src:url(data:font/woff2;base64," +
  fs.readFileSync(path.join(__dirname, fontDir + 'ibm-plex-sans-latin-' + w + '-normal.woff2')).toString('base64') + ") format('woff2')}").join('\n');

const out = app
  .replace('/*FONTS*/', () => fonts)
  .replace('/*JSPDF*/', () => '/* jsPDF 2.5.2 — MIT license — (c) James Hall, yWorks GmbH */\n' + jspdf)
  .replace('/*ENGINE*/', () => engine);

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/opentrak.html'), out);
// docs/ is what GitHub Pages serves (Settings → Pages → main branch, /docs folder)
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs/index.html'), out);
fs.writeFileSync(path.join(__dirname, 'docs/.nojekyll'), '');
console.log('Built dist/opentrak.html and docs/index.html (' + Math.round(out.length / 1024) + ' KB)');
