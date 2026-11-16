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

// Spell checker: nspell (MIT) bundled with esbuild, en_US Hunspell dictionary (SCOWL, MIT AND BSD), construction word list
const esbuild = require('esbuild');
const nspellJs = esbuild.buildSync({ entryPoints: [path.join(__dirname, 'vendor-src/nspell-entry.js')], bundle: true, write: false, format: 'iife', minify: true, platform: 'browser' }).outputFiles[0].text;
const dicDir = 'node_modules/dictionary-en/';
const js = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const spellData = 'window.__SPELL=' + js({ aff: read(dicDir + 'index.aff'), dic: read(dicDir + 'index.dic'), words: read('src/words.txt').split(/\r?\n/).filter((w) => w && !w.startsWith('#')) }) + ';';

const out = app
  .replace('/*SPELL*/', () => '/* nspell 2.1.5 — MIT — (c) Titus Wormer. en_US dictionary from SCOWL / dictionary-en — MIT AND BSD */\n' + nspellJs + '\n' + spellData)
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
