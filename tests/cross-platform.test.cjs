'use strict';
/** Garde-fous pour la publication Windows + macOS (v0.14.0). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.join(__dirname, '..');
const pkg = require('../package.json');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function pngSize(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.ok(bytes.subarray(1, 4).toString() === 'PNG', `${file} n’est pas un PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('les installateurs Windows ne s’écrasent pas entre eux (NSIS ≠ portable)', () => {
  const setup = pkg.build.nsis.artifactName, portable = pkg.build.portable?.artifactName;
  assert.ok(setup && portable, 'noms explicites requis pour NSIS et portable');
  assert.notEqual(setup, portable);
  assert.match(setup, /Setup\.\$\{ext\}$/);
  assert.match(portable, /Portable\.\$\{ext\}$/);
  for (const name of [setup, portable, pkg.build.mac.artifactName]) assert.match(name, /\$\{arch\}/);
  // Sans cette option, electron-builder produit EN PLUS un installateur « universel » x64+arm64 (taille doublée).
  assert.equal(pkg.build.nsis.buildUniversalInstaller, false);
  assert.equal(pkg.build.portable.buildUniversalInstaller, false);
});

test('macOS : signature ad hoc pour éviter « application endommagée » sur Apple Silicon', () => {
  assert.equal(pkg.build.mac.identity, '-');
  assert.equal(pkg.build.mac.hardenedRuntime, false);
});

test('une seule instance et identifiant Windows identique à appId', () => {
  const main = read('electron/main.cjs');
  assert.match(main, /requestSingleInstanceLock\(\)/);
  assert.match(main, /app\.on\('second-instance'/);
  assert.match(main, new RegExp(`APP_ID = '${pkg.build.appId.replace(/\./g, '\\.')}'`));
  assert.match(main, /setAppUserModelId\(APP_ID\)/);
  assert.match(main, /PORTABLE_EXECUTABLE_FILE/);
});

test('icônes de zone de notification adaptées à chaque système', () => {
  assert.deepEqual(pngSize('assets/trayTemplate.png'), { width: 16, height: 16 });
  assert.deepEqual(pngSize('assets/trayTemplate@2x.png'), { width: 32, height: 32 });
  assert.ok(fs.existsSync(path.join(root, 'assets/icon.ico')));
  const main = read('electron/main.cjs');
  assert.match(main, /trayTemplate\.png/);
  assert.match(main, /setTemplateImage\(true\)/);
});

test('macOS : zone de déplacement pour la barre de titre intégrée', () => {
  const css = read('renderer/liquid-ui.css');
  assert.match(css, /html\[data-platform="darwin"\] \.window-drag\{[^}]*-webkit-app-region:drag/);
  assert.match(css, /-webkit-app-region:no-drag/);
  assert.match(read('renderer/index.html'), /class="window-drag"/);
  assert.match(read('electron/preload.cjs'), /dataset\.platform/);
});

test('lecture PDF possible même sans binaire @napi-rs/canvas (Mac Intel, Windows ARM)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alterradar-pdf-'));
  const script = `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function (request, ...rest) {
      if (String(request).startsWith('@napi-rs/canvas')) throw new Error('binaire natif absent (simulation)');
      return load.call(this, request, ...rest);
    };
    const fs = require('node:fs');
    const { createPdfFile } = require(${JSON.stringify(path.join(root, 'lib/documents.cjs'))});
    const { extractPdfText } = require(${JSON.stringify(path.join(root, 'lib/pdf-text.cjs'))});
    (async () => {
      const file = ${JSON.stringify(path.join(dir, 'cv.pdf'))};
      await createPdfFile(file, 'Camille Martin\\nCompétences\\n• React, TypeScript\\nFormation\\nBachelor', 'cv', { name: 'Camille Martin' }, { company: 'Exemple', title: 'Alternance web' });
      process.stdout.write(await extractPdfText(fs.readFileSync(file)));
    })().catch(error => { console.error(error); process.exit(1); });`;
  try {
    const out = cp.execFileSync(process.execPath, ['-e', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(out, /React/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('métadonnées DOCX et PDF au nom du candidat, pas du créateur du logiciel', async () => {
  const { createDocxBuffer, createPdfFile } = require('../lib/documents.cjs');
  const JSZip = require('jszip');
  const profile = { name: 'Camille Martin', email: 'camille@example.com' };
  const job = { company: 'Exemple', title: 'Alternance développeur' };
  const docx = await createDocxBuffer('Camille Martin\nCompétences\n• React', 'cv', profile, job);
  const core = await (await JSZip.loadAsync(docx)).file('docProps/core.xml').async('string');
  assert.match(core, /<dc:creator>Camille Martin<\/dc:creator>/);
  assert.doesNotMatch(core, /MAHINTAN/i);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alterradar-meta-'));
  try {
    const file = path.join(dir, 'cv.pdf');
    await createPdfFile(file, 'Camille Martin\nCompétences\n• React', 'cv', profile, job);
    const raw = fs.readFileSync(file).toString('latin1');
    const author = /\/Author (\d+) 0 R/.exec(raw);
    assert.ok(author, 'champ Author absent du PDF');
    assert.ok(raw.includes(`${author[1]} 0 obj\n(Camille Martin)`), 'Author du PDF différent du candidat');
    assert.ok(!/MAHINTAN/i.test(raw), 'le nom du créateur ne doit pas figurer dans le PDF');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('fins de ligne : .bat en CRLF, scripts macOS en LF', () => {
  const attributes = read('.gitattributes');
  assert.match(attributes, /\*\.bat\s+text eol=crlf/);
  assert.match(attributes, /\*\.command\s+text eol=lf/);
  const bat = fs.readFileSync(path.join(root, 'Lancer-AlterRADAR.bat'), 'latin1');
  assert.ok(!/[^\r]\n/.test(bat), 'Lancer-AlterRADAR.bat doit utiliser CRLF (sinon goto/labels peuvent échouer)');
  assert.ok(!read('Lancer-AlterRADAR.command').includes('\r'), 'Lancer-AlterRADAR.command doit rester en LF');
});

test('CI : autotest des applications construites sur Windows et macOS, sans dossiers décompressés publiés', () => {
  const wf = read('.github/workflows/build-desktop.yml');
  assert.match(wf, /win-unpacked\\AlterRADAR\.exe/);
  assert.match(wf, /--self-test=/);
  assert.match(wf, /Contents\/MacOS\/AlterRADAR/);
  assert.match(wf, /release\/\*\.exe/);
  assert.doesNotMatch(wf, /path: release\/\*\s*$/m);
  assert.match(read('electron/main.cjs'), /async function runSelfTest\(\)/);
});
