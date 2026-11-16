// Builds dist/opentrak.html: one self-contained file (app + CPM engine + jsPDF), no network access needed.
'use strict';
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const app = read('src/app.html');
const engine = read('src/engine.js');
const jspdf = read('node_modules/jspdf/dist/jspdf.umd.min.js').replace(/\/\/# sourceMappingURL=.*$/m, '');
if (/<\/script/i.test(engine + jspdf)) throw new Error('Refusing to inline a script containing </script>');

const out = app
  .replace('/*JSPDF*/', () => '/* jsPDF 2.5.2 — MIT license — (c) James Hall, yWorks GmbH */\n' + jspdf)
  .replace('/*ENGINE*/', () => engine);

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/opentrak.html'), out);
console.log('Built dist/opentrak.html (' + Math.round(out.length / 1024) + ' KB)');
