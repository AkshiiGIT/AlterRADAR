'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8');
const docs=fs.readFileSync(path.join(__dirname,'../lib/documents.cjs'),'utf8');
const sources=require('../lib/sources.cjs');

test('Un CV en une seule page adapte les expériences à l’offre et réessaie sans réécrire le CV original',()=>{
  assert.match(main,/UN CV A4 D’UNE SEULE PAGE/);
  assert.match(main,/expériences sans lien direct/);
  assert.match(main,/for\(let revision=0; revision<=2; revision\+\+\)/);
  assert.match(main,/layoutPlan\(text,kind,state\.profile,job\)/);
  assert.match(main,/if\(!fitted\)throw new Error/);
  assert.match(docs,/trop long pour une seule page A4 lisible/);
  assert.doesNotMatch(docs,/doc\.addPage\(\)/);
});
test('La surveillance propose 5 minutes mais respecte les quotas et ne recharge pas le renderer',()=>{
  assert.match(main,/intervalMinutes:5/);
  assert.match(main,/Math\.max\(5,Number\(state\.settings\.intervalMinutes\)\|\|5\)\*60000/);
  assert.match(ui,/\[5,10,15,30,60,120,240,720,1440\]/);
  assert.equal(sources.DEFAULT_COOLDOWN_MINUTES.alternancestech,5);
  assert.equal(sources.DEFAULT_COOLDOWN_MINUTES.arbeitnow,5);
  assert.ok(sources.DEFAULT_COOLDOWN_MINUTES.remotive>5);
  assert.match(ui,/Chaque API garde son propre délai/);
});
