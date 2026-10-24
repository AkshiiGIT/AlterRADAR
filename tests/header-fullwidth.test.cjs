'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Le bandeau supérieur est bord à bord, avec un contenu aligné sur les cartes',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../renderer/style.css'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8');
  assert.match(js,/<header class="topbar">/);
  assert.match(css,/\.main-area > \.topbar\s*\{/);
  assert.match(css,/margin-inline:\s*calc\(-1 \* var\(--ar-header-gutter\)\)/);
  assert.match(css,/padding-inline:\s*var\(--ar-header-gutter\)/);
  assert.match(css,/@media \(max-width: 760px\)[\s\S]*?--ar-header-gutter: 15px/);
});
