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

// Carlito (SIL OFL 1.1): metric-compatible with Calibri, which can't be redistributed. The UI preview uses the
// woff2; jsPDF needs TrueType, so the WOFF files are unpacked to plain TTF here (WOFF is zlib-compressed SFNT tables).
const carDir = 'node_modules/@fontsource/carlito/files/';
const woffToTtf = (buf) => {
  const zlib = require('zlib');
  if (buf.readUInt32BE(0) !== 0x774f4646) throw new Error('Not a WOFF file');
  const n = buf.readUInt16BE(12), tables = [];
  for (let i = 0; i < n; i++) {
    const e = 44 + i * 20, tag = buf.readUInt32BE(e), off = buf.readUInt32BE(e + 4), len = buf.readUInt32BE(e + 8), orig = buf.readUInt32BE(e + 12), sum = buf.readUInt32BE(e + 16);
    const raw = buf.subarray(off, off + len); tables.push({ tag, sum, data: len < orig ? zlib.inflateSync(raw) : raw });
  }
  let pow = 1, lg = 0; while (pow * 2 <= n) { pow *= 2; lg++; }
  const head = Buffer.alloc(12 + n * 16); head.writeUInt32BE(buf.readUInt32BE(4), 0); head.writeUInt16BE(n, 4); head.writeUInt16BE(pow * 16, 6); head.writeUInt16BE(lg, 8); head.writeUInt16BE(n * 16 - pow * 16, 10);
  const parts = [head]; let at = head.length;
  tables.forEach((t, i) => { const r = 12 + i * 16; head.writeUInt32BE(t.tag, r); head.writeUInt32BE(t.sum, r + 4); head.writeUInt32BE(at, r + 8); head.writeUInt32BE(t.data.length, r + 12);
    const pad = (4 - (t.data.length % 4)) % 4; parts.push(t.data, Buffer.alloc(pad)); at += t.data.length + pad; });
  return Buffer.concat(parts);
};
const carB64 = (w, ext) => fs.readFileSync(path.join(__dirname, carDir + 'carlito-latin-' + w + '-normal.' + ext)).toString('base64');
const carlitoCss = '/* Carlito — SIL OFL 1.1 — (c) The Carlito Project Authors */\n' + [400, 700].map((w) =>
  "@font-face{font-family:'Carlito';font-style:normal;font-weight:" + w + ";font-display:swap;src:url(data:font/woff2;base64," + carB64(w, 'woff2') + ") format('woff2')}").join('\n');
const carlitoPdf = 'window.__PDFFONTS=' + JSON.stringify({ carlito: { normal: woffToTtf(fs.readFileSync(path.join(__dirname, carDir + 'carlito-latin-400-normal.woff'))).toString('base64'), bold: woffToTtf(fs.readFileSync(path.join(__dirname, carDir + 'carlito-latin-700-normal.woff'))).toString('base64') } }) + ';';

// Spell checker: nspell (MIT) bundled with esbuild, en_US Hunspell dictionary (SCOWL, MIT AND BSD), construction word list
const esbuild = require('esbuild');
const nspellJs = esbuild.buildSync({ entryPoints: [path.join(__dirname, 'vendor-src/nspell-entry.js')], bundle: true, write: false, format: 'iife', minify: true, platform: 'browser' }).outputFiles[0].text;
const dicDir = 'node_modules/dictionary-en/';
const js = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const spellData = 'window.__SPELL=' + js({ aff: read(dicDir + 'index.aff'), dic: read(dicDir + 'index.dic'), words: read('src/words.txt').split(/\r?\n/).filter((w) => w && !w.startsWith('#')) }) + ';';

const out = app
  .replace('/*SPELL*/', () => '/* nspell 2.1.5 — MIT — (c) Titus Wormer. en_US dictionary from SCOWL / dictionary-en — MIT AND BSD */\n' + nspellJs + '\n' + spellData)
  .replace('/*FONTS*/', () => fonts + '\n' + carlitoCss)
  .replace('/*JSPDF*/', () => '/* jsPDF 2.5.2 — MIT license — (c) James Hall, yWorks GmbH */\n' + jspdf + '\n/* Carlito — SIL OFL 1.1 — (c) The Carlito Project Authors */\n' + carlitoPdf)
  .replace('/*ENGINE*/', () => engine);

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/opentrak.html'), out);
// docs/ is what GitHub Pages serves (Settings → Pages → main branch, /docs folder)
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs/index.html'), out);
fs.writeFileSync(path.join(__dirname, 'docs/.nojekyll'), '');
console.log('Built dist/opentrak.html and docs/index.html (' + Math.round(out.length / 1024) + ' KB)');
