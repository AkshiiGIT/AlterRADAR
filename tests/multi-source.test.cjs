'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {SOURCES,DEFAULT_ENABLED,searchAll,fetchProvider,validSourceIds,normalizeJob,parseCommunityMarkdown,migrateEnabledSources}=require('../lib/sources.cjs');
const {mergeDiscovered,institutionListing,detectPublicApplicationEmail}=require('../lib/discovery.cjs');
const {extractCandidateProfile,validatedProfile}=require('../lib/profile.cjs');
const {defaultRules}=require('../lib/rules.cjs');
const reply=payload=>({ok:true,json:async()=>payload});
const job=(title='Développeur en alternance',company='Entreprise Exemple',url='https://example.org/offer/1',description='Alternance Bac+3 JavaScript. Envoyer à recrutement@example.fr')=>({title,company,url,description,location:'Paris'});
test('sources are curated; no URLs provided by candidates and no API keys for first launch',()=>{
  assert.equal(SOURCES.length,11);assert.equal(DEFAULT_ENABLED.length,7);
  assert.deepEqual(validSourceIds(['arbeitnow','arbeitnow','unsupported','adzuna']),['arbeitnow','adzuna']);
  assert.equal(SOURCES.find(x=>x.id==='labonnealternance').auth,'key');
  assert.equal(DEFAULT_ENABLED.includes('labonnealternance'),false);
});
test('Arbeitnow and Remotive are normalized and independent of each other',async()=>{
  const fetched=[];
  const f=async url=>{fetched.push(url);if(url.includes('arbeitnow'))return reply({data:[{title:'Alternance cybersécurité',company_name:'Acme',url:'https://jobs.example.org/a',location:'Paris',description:'Bac+3'}]});if(url.includes('remotive'))throw Error('HTTP 429');throw Error('unexpected');};
  const data=await searchAll({enabled:['arbeitnow','remotive'],fetchImpl:f});
  assert.equal(data.jobs.length,2);assert.equal(data.sources[0].status,'ok');assert.equal(data.sources[1].status,'error');assert.equal(data.jobs[0].company,'Acme');
});
test('normalized sources discard missing titles or unsafe URLs',()=>{
  assert.equal(normalizeJob({title:'Alternance',url:'http://bad.com'},'A'),null);
  assert.equal(normalizeJob({title:'Alternance',url:'https://jobs.example.com/a',description:'<b>Bonjour</b>'},'A').description,'Bonjour');
});
test('filtering enforces Bac+3 and removes private schools even on high match score',()=>{
  const docs=defaultRules();
  const a=job('Alternance Python','Entreprise Tech','https://example.org/1','Alternance Bac+5 développeur Python');
  const b=job('Alternance Python','CFA Privé','https://example.org/2','Alternance Bac+3 développeur Python');
  const c=job('Alternance Python','Startup France','https://example.org/3','Alternance Bac+3 développeur Python. Email recrutement@startup.fr');
  const r=mergeDiscovered([],[a,b,c],{profile:{level:'3',roles:'Python'},rules:docs,excludePrivateSchools:true});
  assert.equal(r.stats.added,1);assert.equal(r.stats.schools,1);assert.equal(r.stats.filtered,1);
  assert.equal(r.jobs[0].applicationEmail,'recrutement@startup.fr');
  assert.equal(institutionListing({company:'Entreprise Tech',description:'Formation dans une école'}),false);
});
test('email extraction reads public ads and never guesses HR addresses',()=>{
  assert.equal(detectPublicApplicationEmail({description:'Contact RH: talents@exemple.fr'}),'talents@exemple.fr');
  assert.equal(detectPublicApplicationEmail({description:'Pour info: noreply@example.fr ; privacy@exemple.fr'}),'');
  assert.equal(detectPublicApplicationEmail({description:'Directeur de recrutement: Jean Dupont'}),'');
});
test('cross-source deduplication preserves applicant state and existing documents',()=>{
  const j=job();const orig={...j,id:require('../lib/domain.cjs').jobId(j.url),status:'entretien',history:[{at:'2026-01-01',event:'Entretien'}]};
  const out=mergeDiscovered([orig],[j],{onlyAlternance:true,rules:defaultRules()});
  assert.equal(out.stats.duplicates,1);assert.equal(out.jobs.length,1);assert.equal(out.jobs[0].status,'entretien');
});
test('offline candidate profile from imported CV and old letter is reviewable',()=>{
  const cv='Akasche MAHINTAN\nakasche@example.fr\nBachelor Informatique Bac+3\nPython, Cisco, Linux, Proxmox';
  const letter='Je cherche une alternance comme développeur web dans le réseau';
  const p=extractCandidateProfile(cv,letter);
  assert.equal(p.name,'Akasche MAHINTAN');assert.equal(p.level,'3');assert.match(p.skills,/Python/);assert.match(p.roles,/Développeur web/i);
  const revised=validatedProfile('{"name":"Inventé","email":"attaquant@bad.com","level":"99","skills":"Python"}',p);
  assert.equal(revised.email,p.email);assert.equal(revised.level,'3');
});
test('cooldowns prevent repeated requests to providers with restrictive API limits',async()=>{
  let n=0;const r=await searchAll({enabled:['remotive'],lastRuns:{remotive:'2026-10-14T10:00:00.000Z'},now:Date.parse('2026-10-14T11:00:00.000Z'),fetchImpl:async()=>{n++;return reply({jobs:[]})}});
  assert.equal(n,0);assert.equal(r.sources[0].status,'skipped');
});

test('French community feed normalizes active apprenticeship rows, never invents contact emails',async()=>{
  const text=`## Cyber
Entreprise | Poste | Ville | Contrat | Début | Niveau | Candidater | Ajoutée
--- | --- | --- | --- | --- | --- | --- | ---
ACME | 🆕 Apprenti technicien réseau | Paris | Apprentissage · 12 mois | 2026 | Bac+3 | [Postuler ↗](https://recrutement.example.fr/a) | 2026
AUTRE | Alternant bac+5 | Lyon | Contrat pro | 2026 | Bac+5 | [Postuler ↗](https://recrutement.example.fr/b) | 2026
ECOLE | Alternance marketing | Nice | Apprentissage | 2026 | Bac+3 | [Postuler ↗](http://unsafe.example.fr/c) | 2026`;
  const jobs=parseCommunityMarkdown(text);
  assert.equal(jobs.length,2);
  const f=async url=>({ok:true,text:async()=>text});
  const source=await fetchProvider('alternancestech',{fetchImpl:f});
  assert.equal(source.length,2);assert.equal(source[0].applicationEmail,'');
  const result=mergeDiscovered([],source,{rules:defaultRules(),onlyAlternance:true,profile:{level:'3'}});
  assert.equal(result.stats.added,1);assert.equal(result.stats.filtered,1);
});
test('first use scans without employer links or credentials',()=>{
  const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'../renderer/app.js'),'utf8');
  assert.match(app,/app:profile-form|form.id==='profile-form'/);
  assert.match(app,/fromOnboarding[\s\S]*window.radar.scanNow\(\)/);
  assert.match(app,/if\(imported && kind==='cv' && ui.state.documents.cv\?\.text/);
  assert.match(app,/window.radar.buildProfileFast\(\)/);
  assert.ok(DEFAULT_ENABLED.includes('alternancestech'));
});

test('migration retains personalized source choices and existing data',()=>{
  assert.deepEqual(migrateEnabledSources(['arbeitnow','remotive','jobicy','himalayas','remoteok','themuse'])[0],'alternancestech');
  assert.deepEqual(migrateEnabledSources(['arbeitnow','adzuna']),['arbeitnow','adzuna']);
  assert.deepEqual(migrateEnabledSources([]),[]);
});
