'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {imageKind,prepareWallpaper,LIMIT_SAVED_BYTES,LIMIT_INPUT_BYTES}=require('../lib/wallpaper.cjs');
const {candidateChanged,resetCandidateData,invalidateGeneratedFiles}=require('../lib/profile-switch.cjs');
const root=path.join(__dirname,'..');

test('Le PNG fourni de ~6,1 Mo est accepté, sans perte ni erreur 8 Mo',()=>{
  const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(6368040-8)]);
  assert.equal(imageKind(bytes).ext,'png');
  const result=prepareWallpaper(bytes);
  assert.equal(result.bytes.length,6368040);
  assert.equal(result.kind.mime,'image/png');
  assert.equal(result.optimized,false);
});
test('Un PNG supérieur à 8 Mo est converti localement en JPG',()=>{
  const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(LIMIT_SAVED_BYTES)]);
  const result=prepareWallpaper(bytes,{createFromBuffer:()=>({isEmpty:()=>false,getSize:()=>({width:2048,height:1536}),toJPEG:()=>Buffer.alloc(140000)})});
  assert.equal(result.kind.ext,'jpg');
  assert.ok(result.bytes.length<LIMIT_SAVED_BYTES);
  assert.equal(result.optimized,true);
});
test('L’import limite les fichiers volumineux et refuse les données non images',()=>{
  assert.throws(()=>prepareWallpaper(Buffer.alloc(LIMIT_INPUT_BYTES+1)),/32 Mo/);
  assert.throws(()=>prepareWallpaper(Buffer.from('bad content')),/PNG, JPG ou WebP/);
});
test('Un changement de personne est reconnu à partir du nouveau CV',()=>{
  const old={name:'Camille Dupont',email:'camille@example.org'};
  const stranger='Morgan Durand\nmorgan@example.org\nBac+3 Informatique React PHP';
  const same='Camille Dupont\ncamille@example.org\nBac+3 Informatique React PHP';
  assert.equal(candidateChanged(old,stranger).changed,true);
  assert.equal(candidateChanged(old,same).changed,false);
});
test('Changer de candidat efface les données actives mais pas les réglages généraux',()=>{
  const state={profile:{name:'Camille'},documents:{cv:{text:'CV'},letter:{text:'LM'}},jobs:[{id:1}],outputs:{1:{cv:'secret'}},rules:[{id:'test'}],monitoring:{lastResult:{id:1}},settings:{theme:'dark',selectedModel:'qwen',onboardingCompleted:true,monitoringEnabled:true,autoPrepare:true,searchZones:[{city:'Paris',radiusKm:10}],sector:'software',telegramApprovalsEnabled:true,telegramTokenEncrypted:'encrypted',telegramChatId:'12345',telegramOffset:12,smtpPasswordEncrypted:'enc',smtpUser:'private',smtpFrom:'old@example.org'}};
  resetCandidateData(state);
  assert.equal(state.profile.name,'');assert.equal(state.documents.letter,null);
  assert.deepEqual(state.jobs,[]);assert.deepEqual(state.outputs,{});
  assert.equal(state.settings.telegramTokenEncrypted,'');assert.equal(state.settings.smtpPasswordEncrypted,'');
  assert.equal(state.settings.theme,'dark');assert.equal(state.settings.selectedModel,'qwen');
});
test('Un CV révisé invalide les dossiers approuvés, mais conserve les offres suivies',()=>{
  const state={outputs:{a:{cv:'old'}},jobs:[{id:'a',status:'validée',reviewNonce:'token',approvedDigest:'digest'},{id:'b',status:'entretien'}]};
  invalidateGeneratedFiles(state);
  assert.deepEqual(state.outputs,{});assert.equal(state.jobs[0].status,'à_revoir');
  assert.equal(state.jobs[0].approvedDigest,'');assert.equal(state.jobs[1].status,'entretien');
});
test('Workflow utilise exclusivement les actions Node 24 et la release en brouillon',()=>{
  const text=fs.readFileSync(path.join(root,'.github/workflows/build-desktop.yml'),'utf8');
  for(const action of ['actions/checkout@v7','actions/setup-node@v7','actions/upload-artifact@v7','actions/download-artifact@v7','softprops/action-gh-release@v3'])assert.ok(text.includes(action));
  assert.match(text,/node-version: '24'/);assert.match(text,/draft: true/);
  assert.match(text,/npm ci --no-audit --no-fund/);
});
