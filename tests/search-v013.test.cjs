'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeZones,normalizeSector,sectorFit,searchFingerprint}=require('../lib/search-preferences.cjs');
const {imageKind,prepareWallpaper,LIMIT_SAVED_BYTES}=require('../lib/wallpaper.cjs');
const {fetchProvider,queryPairs,searchAll}=require('../lib/sources.cjs');
const reply=x=>({ok:true,json:async()=>x});
test('les zones acceptent plusieurs villes/rayons, éliminent les doublons et bornent les entrées',()=>{
 assert.deepEqual(normalizeZones('Paris | 30\nÉvry | 25\nParis | 10'),[{city:'Paris',radiusKm:30},{city:'Évry',radiusKm:25}]);
 assert.throws(()=>normalizeZones('Paris | 300'),/rayon/);
 assert.throws(()=>normalizeZones([{city:'X',radiusKm:10}]),/ville/i);
 assert.throws(()=>normalizeZones(Array.from({length:13},(_,i)=>({city:`Ville ${i}`,radiusKm:15}))),/12/);
});
test('toutes les zones sont interrogées avant de diversifier les métiers',()=>{
 const zones=normalizeZones('Paris | 15\nLyon | 30\nLille | 20');
 assert.deepEqual(queryPairs(['developpeur','data'],zones).slice(0,3).map(x=>x.zone.city),['Paris','Lyon','Lille']);
});
test('le secteur sélectionné filtre le titre sans modifier le CV du candidat',()=>{
 assert.equal(normalizeSector('software'),'software');assert.throws(()=>normalizeSector('fabricated'));
 assert.equal(sectorFit({title:'Développeur PHP Symfony'},'software').eligible,true);
 assert.equal(sectorFit({title:'Assistant commercial'},'software').eligible,false);
 assert.equal(sectorFit({title:'Assistant commercial'},'all').eligible,true);
 assert.equal(sectorFit({title:'Technicien réseau en alternance'},'it').eligible,true);
});
test('les changements de ville, rayon et secteur modifient la clé de scan',()=>{
 const a=searchFingerprint({profile:{roles:'Développeur'},settings:{searchZones:[{city:'Paris',radiusKm:20}],sector:'software'}});
 const b=searchFingerprint({profile:{roles:'Développeur'},settings:{searchZones:[{city:'Paris',radiusKm:40}],sector:'software'}});
 assert.notEqual(a,b);
});
test('Adzuna reçoit chaque ville et chaque rayon en km, sans clés personnelles dans le résultat',async()=>{
 const urls=[],fake=async u=>{urls.push(String(u));return reply({results:[]});};
 await fetchProvider('adzuna',{credentials:{appId:'id',appKey:'secret'},zones:[{city:'Paris',radiusKm:35},{city:'Lille',radiusKm:15}],profile:{roles:'Développeur web'},fetchImpl:fake});
 assert.ok(urls.some(u=>u.includes('where=Paris')&&u.includes('distance=35')));
 assert.ok(urls.some(u=>u.includes('where=Lille')&&u.includes('distance=15')));
});
test('France Travail utilise les codes INSEE résolus puis le rayon officiel',async()=>{
 const urls=[],fake=async u=>{urls.push(String(u));if(u.includes('oauth2'))return reply({access_token:'test'});if(u.includes('geo.api.gouv.fr'))return reply([{nom:'Paris',code:'75056'}]);return reply({resultats:[]});};
 await fetchProvider('francetravail',{credentials:{clientId:'a',clientSecret:'b'},zones:[{city:'Paris',radiusKm:35}],profile:{roles:'Développeur web'},fetchImpl:fake});
 assert.ok(urls.some(u=>u.includes('commune=75056')&&u.includes('distance=35')));
});
test('source cassée reste identifiée séparément, sans masquer une autre source',async()=>{
 const r=await searchAll({enabled:['remotive','arbeitnow'],fetchImpl:async url=>{
 if(url.includes('remotive'))return {ok:false,status:429};
 return reply({data:[]});
 }});
 assert.equal(r.sources.find(x=>x.id==='remotive').status,'error');
 assert.equal(r.sources.find(x=>x.id==='arbeitnow').status,'ok');
});
test('PNG en dessous de 8 Mo accepté, PNG trop lourd converti par Electron simulé',()=>{
 const header=Buffer.from([137,80,78,71,13,10,26,10]);
 const input=Buffer.concat([header,Buffer.alloc(8*1024*1024)]);
 assert.equal(imageKind(input).ext,'png');
 const output=prepareWallpaper(input,{createFromBuffer:()=>({isEmpty:()=>false,getSize:()=>({width:2048,height:1400}),resize:()=>({toJPEG:()=>Buffer.alloc(210000)}),toJPEG:()=>Buffer.alloc(210000)})});
 assert.equal(output.kind.ext,'jpg');assert.equal(output.optimized,true);assert.ok(output.bytes.length<LIMIT_SAVED_BYTES);
});

test('Himalayas suit nextCursor au lieu du paramètre offset déprécié',async()=>{
 const urls=[];
 await fetchProvider('himalayas',{fetchImpl:async url=>{
  urls.push(url);return reply({jobs:[],nextCursor:urls.length===1?'page2':''});
 }});
 assert.equal(urls.length,2);
 assert.ok(urls[1].includes('cursor=page2'));assert.ok(urls.every(u=>!u.includes('offset=')));
});
