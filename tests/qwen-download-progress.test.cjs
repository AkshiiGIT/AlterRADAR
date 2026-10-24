'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const {parsePullUpdate,createPullTracker,allowedModel}=require('../lib/ollama.cjs');
const read=f=>readFileSync(path.join(__dirname,'..',f),'utf8');
test('Progression calculée depuis les octets Ollama, sans inventer un total du modèle',()=>{
  assert.deepEqual(parsePullUpdate('{"status":"pulling abc", "total":1000000000,"completed":250000000}'),{
    status:'pulling abc',percent:25,completed:250000000,total:1000000000,error:''
  });
  const waiting=parsePullUpdate('{"status":"pulling manifest"}');
  assert.equal(waiting.percent,null);assert.equal(waiting.completed,null);assert.equal(waiting.total,null);
});
test('Aucune progression fictive en cas de total nul ou négatif',()=>{
  for(const x of ['{"total":0,"completed":0}','{"total":-99,"completed":5}','{"total":100,"completed":-1}']){
    const item=parsePullUpdate(x);assert.equal(item.percent,null);assert.equal(item.total,null);
  }
  assert.equal(parsePullUpdate('{"total":100,"completed":1000}').percent,100);
  assert.throws(()=>parsePullUpdate('{broken'),/invalide/);
  assert.throws(()=>parsePullUpdate('[]'),/invalide/);
});
test('Mesure du débit et ETA uniquement avec des échantillons cohérents',()=>{
  const track=createPullTracker();
  assert.equal(track(parsePullUpdate('{"status":"pulling a","total":1000,"completed":100}'),0).speedBytesPerSecond,null);
  const p=track(parsePullUpdate('{"status":"pulling a","total":1000,"completed":600}'),1000);
  assert.equal(p.percent,60);assert.equal(p.speedBytesPerSecond,500);assert.equal(p.etaSeconds,1);
});
test('Changement de blob, statut ou recul du compteur réinitialise la vitesse',()=>{
  const track=createPullTracker();
  track(parsePullUpdate('{"status":"pulling a","total":1000,"completed":100}'),0);
  assert.equal(track(parsePullUpdate('{"status":"pulling a","total":1000,"completed":300}'),1000).speedBytesPerSecond,200);
  const next=track(parsePullUpdate('{"status":"pulling b","total":3000,"completed":300}'),2000);
  assert.equal(next.speedBytesPerSecond,null);assert.equal(next.etaSeconds,null);
  assert.equal(track(parsePullUpdate('{"status":"pulling b","total":3000,"completed":200}'),3000).speedBytesPerSecond,null);
  assert.equal(track(parsePullUpdate('{"status":"verifying","total":0,"completed":0}'),4000).percent,null);
});
test('Seuls les modèles du catalogue sont téléchargeables',()=>{
  assert.equal(allowedModel('qwen2.5:3b'),true);
  assert.equal(allowedModel('attacker.com/unauthorized'),false);
});
test('Le panneau de suivi ne reconstruit pas toute la navigation',()=>{
  const main=read('electron/main.cjs'),preload=read('electron/preload.cjs'),ui=read('renderer/app.js'),css=read('renderer/style.css');
  assert.match(main,/modelPulling=true;[\s\S]{0,160}const controller=new AbortController/);
  assert.match(main,/signal:AbortSignal\.any\(\[controller\.signal,AbortSignal\.timeout/);
  assert.match(main,/ipcMain\.handle\('app:cancel-model-pull'/);
  assert.match(main,/ipcMain\.handle\('app:model-pull-status'/);
  assert.match(main,/const track=createPullTracker\(\)/);
  assert.match(preload,/cancelModelPull/);
  assert.match(ui,/onModelPull\(info=>\{ui\.modelProgress=info;paintModelPull\(\);\}\)/);
  assert.match(ui,/id="model-pull-dock"/);
  assert.match(ui,/id="model-pull-inline"/);
  assert.match(ui,/data-action="cancel-model-pull"/);
  assert.match(ui,/pas du modèle entier/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
