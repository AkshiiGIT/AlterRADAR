'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {pickJobRecords,jobToNormalized,safeQuery,validateRelayUrl}=require('../lib/lba-gateway.cjs');
const {fetchProvider,RELAY_URL}=require('../lib/sources.cjs');
const ok=p=>({ok:true,json:async()=>p});
test('LBA ne reçoit pas de données personnelles dans une requête avec clé individuelle',async()=>{
 const calls=[];
 const fetchImpl=async (url,options={})=>{
  calls.push({url:String(url),options});
  if(String(url).startsWith('https://geo.api.gouv.fr/'))return ok([{nom:'Paris',centre:{coordinates:[2.3522,48.8566]}}]);
  return ok({jobs:[{offer:{title:'Alternant développeur web',description:'Développement PHP'},workplace:{name:'Exemple'},location:{address:'Paris'},apply:{url:'https://exemple.fr/emploi/1'}}]});
 };
 const list=await fetchProvider('labonnealternance',{credentials:{apiKey:'fake-private'},fetchImpl,zones:[{city:'Paris',radiusKm:25}],profile:{name:'Prénom Test',email:'secret@example.com'}});
 assert.equal(list.length,1);
 assert.equal(list[0].title,'Alternant développeur web');
 assert.ok(calls.some(c=>c.url.includes('radius=25')&&c.url.includes('longitude=2.3522')&&c.url.includes('latitude=48.8566')));
 assert.equal(JSON.stringify(calls).includes('secret@example.com'),false);
 assert.equal(RELAY_URL,'');
});
test('La bonne alternance : parse uniquement de véritables listes d’offres',()=>{
 const obj={offres_emploi_lba:[{offer:{title:'Développeuse'},apply:{url:'https://site.fr/a'}}],offres_emploi_partenaires:[{title:'Ingénieur'}]};
 assert.equal(pickJobRecords(obj).length,2);
 assert.equal(pickJobRecords({payload:{jobs:[{title:'A'}]}}).length,1);
 assert.deepEqual(pickJobRecords({foo:{bar:1}}),[]);
 assert.equal(jobToNormalized(obj.offres_emploi_lba[0]).url,'https://site.fr/a');
});
test('Le relais interdit une URL locale ou non HTTPS',()=>{
 assert.throws(()=>validateRelayUrl('http://example.com'));
 assert.throws(()=>validateRelayUrl('https://127.0.0.1'));
 assert.equal(validateRelayUrl('https://alterradar-alternance.example.workers.dev'),'https://alterradar-alternance.example.workers.dev');
 assert.throws(()=>safeQuery({city:'Paris',radiusKm:101}),/rayon/i);
});
test('Worker : accès lecture seule, identité et documents jamais envoyés à la source',async()=>{
 const {handle}=await import('../relay/worker.mjs');
 const prev=global.fetch;const calls=[];
 global.fetch=async (url,init)=>{
  calls.push({url:String(url),init});
  if(String(url).includes('geo.api.gouv.fr'))return {ok:true,json:async()=>[{nom:'Paris',centre:{coordinates:[2.3522,48.8566]}}]};
  return {ok:true,text:async()=>JSON.stringify({jobs:[{title:'Alternance web'}]})};
 };
 try{
  const request=new Request('https://relay.test/v1/offers?city=Paris&radiusKm=30');
  const answer=await handle(request,{LBA_API_KEY:'test-secret'},{cache:null});
  assert.equal(answer.status,200);
  const p=await answer.json();assert.equal(p.payload.jobs.length,1);
  assert.ok(calls.some(c=>c.url.includes('longitude=2.3522')&&c.url.includes('latitude=48.8566')&&c.url.includes('radius=30')));
  assert.ok(!JSON.stringify(p).includes('test-secret'));
  assert.equal((await handle(new Request('https://relay.test/v1/offers',{method:'POST'}),{LBA_API_KEY:'test-secret'})).status,405);
  assert.equal((await handle(new Request('https://relay.test/v1/offers?radiusKm=999'),{LBA_API_KEY:'test-secret'})).status,400);
 }finally{global.fetch=prev;}
});
