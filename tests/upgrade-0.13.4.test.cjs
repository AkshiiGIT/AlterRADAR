'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {sortJobs}=require('../renderer/job-sort.js');
const {cityFromLocation,distanceKm,approximateDistances}=require('../lib/proximity.cjs');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('Tri pertinence par score décroissant stable',()=>{
 const jobs=[{id:'a',score:45},{id:'b',score:92},{id:'c',score:60}];
 assert.deepEqual(sortJobs(jobs,'score').map(x=>x.id),['b','c','a']);
 assert.deepEqual(jobs.map(x=>x.id),['a','b','c']);
});
test('Tri récentes trie sur les dates de publication et garde les inconnues en dernier',()=>{
 const jobs=[{id:'a',score:90,publishedAt:'2026-10-10'}, {id:'b',score:30,publishedAt:'2026-10-15'}, {id:'c',score:60,addedAt:'2026-10-13'}, {id:'d',score:100}];
 assert.deepEqual(sortJobs(jobs,'recent').map(x=>x.id),['b','a','d','c']);
});
test('Tri proximité : inconnues en dernier, et score pour les égalités',()=>{
 const jobs=[{id:'a',score:90},{id:'b',score:12},{id:'c',score:80},{id:'d',score:1}];
 assert.deepEqual(sortJobs(jobs,'distance',{a:25,b:5,d:5}).map(x=>x.id),['b','d','a','c']);
});
test('Localisations non précises rejetées sans inventer une distance',()=>{
 assert.equal(cityFromLocation('Télétravail'), '');
 assert.equal(cityFromLocation('75001 Paris, Île-de-France'),'Paris');
 assert.equal(cityFromLocation('Villeurbanne (69)'),'Villeurbanne');
 assert.equal(distanceKm([2.35,48.86],[2.35,48.86]),0);
 assert.ok(distanceKm([2.35,48.86],[2.23,48.88])>5);
});
test('Distances validées par réponses simulées du géocodeur, jamais par nom arbitraire',async()=>{
 let calls=0;
 const centres={'Paris':[2.35,48.86], 'Melun':[2.66,48.54], 'Lille':[3.06,50.63]};
 const fakeFetch=async u=>{calls++;const city=new URL(u).searchParams.get('nom');return {ok:true,json:async()=>centres[city]?[{nom:city,centre:{coordinates:centres[city]}}]:[]};};
 const result=await approximateDistances([{id:'paris',location:'Paris'},{id:'melun',location:'Melun (77)'},{id:'remote',location:'Remote'},{id:'lille',location:'Lille'}],[{city:'Paris',radiusKm:35}],fakeFetch);
 assert.equal(result.distances.paris,0);
 assert.ok(result.distances.melun>30);
 assert.ok(result.distances.lille>100);
 assert.equal(result.distances.remote,undefined);
 assert.equal(result.known,3);
 assert.ok(calls<=4);
});
test('Navigation possible pendant une analyse, mais pas les actions concurrentes',()=>{
 const app=read('renderer/app.js');
 assert.match(app,/if\(node\.dataset\.nav\)\{/);
 const start=app.indexOf('if(node.dataset.nav)');const busy=app.indexOf('if(ui.busy)return; \/\/ Les actions',start);
 assert.ok(start>0&&busy>start);
 assert.match(app,/task-progress/);
});
test('Palette par défaut noir et blanc, sombre anthracite et accent Twilight Purple',()=>{
 const main=read('electron/main.cjs');const css=read('renderer/style.css');const html=read('renderer/index.html');
 assert.match(main,/settings: \{ theme: 'light'/);
 assert.match(css,/AlterRADAR 0\.13\.4 — Monochrome first/);
 assert.match(css,/--bg:#08090d/);
 assert.match(css,/--accent:#c3a0e0/);
 assert.match(html,/job-sort\.js/);
 assert.match(main,/ipcMain\.handle\('app:job-distances'/);
});
