'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const style=fs.readFileSync(path.join(root,'renderer/style.css'),'utf8');
const ui=fs.readFileSync(path.join(root,'renderer/app.js'),'utf8');
const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
test('app adapts to small and large desktop viewports without global horizontal scroll',()=>{
  assert.match(style,/\.app-shell\s*\{[^}]*height:\s*100dvh/);
  assert.match(style,/\.main-area\s*\{[^}]*overflow-y:\s*auto;\s*overflow-x:\s*hidden/);
  assert.match(style,/@media\s*\(max-width:\s*990px\)/);
  assert.match(style,/@media\s*\(max-width:\s*760px\)/);
});
test('navigation remains discoverable in icon-only sidebar',()=>{
  assert.match(ui,/title="\$\{esc\(title\)\}" aria-label="\$\{esc\(title\)\}"/);
  assert.match(style,/\.nav-item > span/);
});
test('in-page interactions preserve current scroll position',()=>{
  assert.match(ui,/previousScroll=oldMain&&ui\.lastRenderedPage===ui\.page\?oldMain\.scrollTop:0/);
  assert.match(ui,/scrollTop=previousScroll/);
});
test('desktop window is sized to screen, maximized only when there is room',()=>{
  assert.match(main,/screen\.getDisplayNearestPoint\(screen\.getCursorScreenPoint\(\)\)\.workArea/);
  assert.match(main,/mainWindow\.maximize\(\)/);
  assert.match(main,/minWidth:\s*760/);
});
