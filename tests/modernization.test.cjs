'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const pkg = require('../package.json');
const {extractPdfText} = require('../lib/pdf-text.cjs');

test('pdf-parse v2 : extraction et libération du worker', async () => {
  const calls = [];
  class Parser {
    constructor(opts){ calls.push(['create',opts.data.length]); }
    async getText(opts){ calls.push(['extract',opts.last]); return {text:'Expérience React, TypeScript et Node.js'}; }
    async destroy(){ calls.push(['destroy']); }
  }
  assert.match(await extractPdfText(Buffer.from('test'),{PDFParse:Parser}),/React/);
  assert.deepEqual(calls,[['create',4],['extract',12],['destroy']]);
});

test('pdf-parse v2 : nettoie les ressources même si le PDF échoue',async()=>{
 let destroyed=false;
 class Parser {
   async getText(){throw new Error('corrompu');}
   async destroy(){destroyed=true;}
 }
 await assert.rejects(extractPdfText(Buffer.from('test'),{PDFParse:Parser}),/Lecture PDF impossible.*corrompu/);
 assert.equal(destroyed,true);
});

test('les imports restent compatibles avec le modèle de données v0.10',()=>{
 const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
 assert.match(main,/schema: 2/);
 assert.match(main,/readState\(\)/);
 assert.match(main,/persist\(\)/);
 assert.match(main,/pdf-text\.cjs/);
 assert.match(main,/telegramPairing/);
 assert.match(main,/deliveryMode:'draft'/);
});

test('la base est modernisée et n’utilise pas de versions preview',()=>{
 assert.equal(pkg.version,'0.14.0');
 assert.equal(pkg.devDependencies.electron,'44.9.3');
 assert.equal(pkg.devDependencies['electron-builder'],'26.15.3');
 assert.equal(pkg.dependencies['pdf-parse'],'2.4.5');
 assert.equal(pkg.dependencies.nodemailer,'10.1.7');
 assert.deepEqual(pkg.engines,{node:'>=24 <25'});
});

test('pipeline : Node 24, npm ci, audit et désactivation de publication builder',()=>{
 const wf=fs.readFileSync(path.join(root,'.github/workflows/build-desktop.yml'),'utf8');
 assert.match(wf,/node-version: '24'/);
 for(const action of ['actions/checkout@v7','actions/setup-node@v7','actions/upload-artifact@v7','actions/download-artifact@v7','softprops/action-gh-release@v3'])assert.ok(wf.includes(action),`Action trop ancienne : ${action}`);
 assert.doesNotMatch(wf,/(?:actions\/(?:checkout|setup-node|upload-artifact|download-artifact)@v4|softprops\/action-gh-release@v2)/);
 assert.match(wf,/npm ci --no-audit --no-fund/);
 assert.match(wf,/npm audit --omit=dev --audit-level=high/);
 // Electron est livré dans l'application : son audit ne doit pas être exclu avec les devDependencies.
 assert.match(wf,/npm run audit:electron/);
 assert.match(wf,/npm run check:lock/);
 assert.match(pkg.scripts['dist:mac'],/--publish never/);
 assert.match(pkg.scripts['dist:win'],/--publish never/);
});

test('espacements de la recherche isolés des autres pages',()=>{
 const app=fs.readFileSync(path.join(root,'renderer/app.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'renderer/style.css'),'utf8');
 assert.match(app,/class="jobs-page"/);
 assert.match(css,/\.jobs-page > \.alert/);
 assert.match(css,/--ar-space-lg: 24px/);
});
