const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'renderer/app.js'),'utf8');
const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/build-desktop.yml'),'utf8');
test('À propos contient crédits, gratuité et confidentialité contextualisée',()=>{
  assert.match(app,/Akasche MAHINTAN/);
  assert.match(app,/n’a pas accès à tes données personnelles/);
  assert.match(app,/Tes données restent sur ton ordinateur par défaut/);
  assert.match(app,/transmis aux serveurs Telegram/);
  assert.match(app,/Gratuit à télécharger et à utiliser/);
  assert.match(app,/akshiiGIT/i);
});
test('Appairage Telegram individuel, privé, temporaire et authentifié',()=>{
  assert.match(main,/createPairingChallenge/);
  assert.match(main,/pairingMatches/);
  assert.match(main,/allowed_updates:\['message','callback_query'\]/);
  assert.match(app,/data-action="telegram-pair"/);
});
test('Workflow CI construit Windows et macOS et prépare une release GitHub',()=>{
  assert.match(workflow,/windows-latest/);
  assert.match(workflow,/macos-latest/);
  assert.match(workflow,/softprops\/action-gh-release/);
});
