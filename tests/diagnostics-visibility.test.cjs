const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8');
const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
const dates=require('../lib/publication-date.cjs');
test('les deux interrupteurs sont indépendants et visibles dans Paramètres',()=>{
 assert.match(app,/id="visibility-form"/);
 assert.match(app,/name="showTrainingListings"/);
 assert.match(app,/name="enableLba"/);
 assert.match(app,/enabled\.add\('labonnealternance'\)/);
 assert.match(app,/enabled\.delete\('labonnealternance'\)/);
 assert.match(app,/excludePrivateSchools:!form\.elements\.showTrainingListings\.checked/);
});
test('le retour d’erreur de date est exposé sans date fabriquée',()=>{
 assert.match(main,/dateCheckError:fresh\.dateCheckError/);
 assert.match(app,/job\.dateCheckError/);
 assert.match(app,/Échec de la vérification/);
});
test('diagnostic : publication valide détectée et absence explicite',async()=>{
 const good=await dates.verifyJobDate({url:'https://entreprise.example/offre',title:'Développeur'}, {fetchPage:async()=>'<script type="application/ld+json">{"@type":"JobPosting","title":"Développeur","datePosted":"2026-10-12"}</script>'});
 assert.equal(good.dateCheckStatus,'verified');
 assert.equal(good.publishedAt,'2026-10-12');
 const missing=await dates.verifyJobDate({url:'https://entreprise.example/offre',title:'Développeur'}, {fetchPage:async()=>'<html><p>Annonce de développeur</p></html>'});
 assert.equal(missing.dateCheckStatus,'unavailable');
 const failure=await dates.verifyJobDate({url:'https://entreprise.example/offre',title:'Développeur'}, {fetchPage:async()=>{throw new Error('HTTP 403');}});
 assert.equal(failure.dateCheckStatus,'error');
 assert.equal(failure.dateCheckError,'HTTP 403');
 assert.equal(failure.publishedAt,'');
});

test('changer la source ou le filtre formation invalide le cache de recherche',()=>{
 const {searchFingerprint}=require('../lib/search-preferences.cjs');
 const profile={roles:'Développeur'};
 const base={sourceEnabled:['arbeitnow'],excludePrivateSchools:true};
 const a=searchFingerprint({profile,settings:base});
 assert.notEqual(a,searchFingerprint({profile,settings:{...base,sourceEnabled:['arbeitnow','labonnealternance']}}));
 assert.notEqual(a,searchFingerprint({profile,settings:{...base,excludePrivateSchools:false}}));
});
