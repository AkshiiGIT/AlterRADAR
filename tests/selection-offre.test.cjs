'use strict';
/**
 * Sélection d'une offre : visible dans la liste, détail remplacé sur place,
 * et animations d'entrée réservées aux vrais changements de page.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lire = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('clic sur une offre : sélection sur place, sans reconstruire la page', () => {
  const app = lire('renderer/app.js');
  assert.match(app, /if\(action==='select-job'\)\{if\(ui\.page==='jobs'&&selectionnerOffreSurPlace\(id\)\)return;/);
  const fonction = app.slice(app.indexOf('function selectionnerOffreSurPlace('), app.indexOf('function jobDetail('));
  assert.ok(fonction.length > 100, 'fonction présente avant jobDetail');
  assert.doesNotMatch(fonction, /render\(\)/, 'aucun rendu complet');
  assert.match(fonction, /colonne\.innerHTML=jobDetail\(job\)/, 'seule la colonne de détail change');
  assert.match(fonction, /classList\.toggle\('selected',choisie\)/);
  assert.match(fonction, /setAttribute\('aria-current','true'\)/);
  assert.match(fonction, /chatMajContexte\(\)/, 'le chatbot suit l’offre ouverte');
  assert.match(app, /<div class="column-flow" id="job-detail-column">/);
});

test('offre sélectionnée : classe et aria-current aussi après un rendu complet', () => {
  const app = lire('renderer/app.js');
  assert.match(app, /const choisie=ui\.page==='jobs'&&ui\.jobId===job\.id;return `<button class="job-row\$\{choisie\?' selected':''\}"/);
  assert.match(app, /\$\{choisie\?' aria-current="true"':''\}/);
  const css = lire('renderer/style.css');
  assert.match(css, /\.job-row\.selected,\.job-row\.selected:hover\{background:var\(--tint\);box-shadow:inset 3px 0 0 var\(--accent\)\}/);
});

test('animations d’entrée : seulement au changement de page, jamais lors d’une mise à jour', () => {
  const css = `${lire('renderer/style.css')}\n${lire('renderer/liquid-ui.css')}`;
  const entrees = css.split('\n').filter(l => /animation:(ar14-rise|ar14-glide|ar-page-enter)/.test(l));
  assert.ok(entrees.length >= 3);
  for (const ligne of entrees) assert.match(ligne, /\[data-view-transition="true"\]/, ligne.slice(0, 90));
  assert.match(lire('renderer/app.js'), /document\.body\.dataset\.viewTransition=ui\.lastRenderedPage!==ui\.page\?'true':'false'/);
});
