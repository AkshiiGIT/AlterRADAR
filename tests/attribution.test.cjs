'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
test('Creator is credited in desktop metadata and UI', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.author, 'Akasche MAHINTAN');
  assert.match(pkg.build.copyright, /Akasche MAHINTAN/);
  assert.match(fs.readFileSync(path.join(root,'renderer/app.js'),'utf8'), /Créé par <strong>Akasche MAHINTAN<\/strong>/);
  assert.match(fs.readFileSync(path.join(root,'renderer/app.js'),'utf8'), /Créé et développé par/);
  assert.match(fs.readFileSync(path.join(root,'LICENSE'),'utf8'), /Copyright \(c\) 2026 Akasche MAHINTAN/);
});
