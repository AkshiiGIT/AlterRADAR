'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateDraft,assertApplicationPair,targetSignature,contractDurations,targetedContractDurations}=require('../lib/candidature-audit.cjs');
const {cvBlocks,letterBlocks}=require('../lib/documents.cjs');
const {normalizeBoardJob}=require('../lib/ats.cjs');
const {verifyJobDate}=require('../lib/publication-date.cjs');
const root=path.join(__dirname,'..');
const source=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const job={id:'demo-1',url:'https://jobs.example.org/posting/123',title:'Développeur full stack',company:'nesto',description:'Alternance de 6 mois en développement web à Lyon.'};
const cv='Développeuse full stack\nObjectif : Je recherche une alternance de 6 mois chez nesto.\nCompétences\nJavaScript et HTML.';
const letter='Madame, Monsieur,\n\nJe souhaite une alternance de 6 mois chez nesto comme développeuse full stack.\n\nJe vous prie d’agréer mes salutations.';
function bundle(fields={}){return {cv,letter,cvTargetSignature:targetSignature(job),letterTargetSignature:targetSignature(job),...fields};}
test('Refuse un destinataire externe ICDC et une durée incompatible',()=>{
 const bad='Objet : Candidature pour ICDC\nJe recherche une alternance de 3 ans chez ICDC.';
 const audit=validateDraft(bad,'letter',job);
 assert.equal(audit.ok,false);
 assert.ok(audit.issues.some(x=>/entreprise/i.test(x)));
 assert.ok(audit.issues.some(x=>/durée/i.test(x)));
 assert.equal(contractDurations(job.description)[0],6);
});
test('Accepte le même employeur et la même durée',()=>{
 assert.equal(validateDraft(letter,'letter',job).ok,true);
 assert.equal(validateDraft(cv,'cv',job).ok,true);
 assert.equal(assertApplicationPair(bundle(),job),true);
});
test('Bloque une durée de contrat non attestée par l’offre sans inventer',()=>{
 const offer={...job,description:'Missions de développement web. Contrat en alternance.'};
 const audit=validateDraft('Je recherche une alternance de 3 ans chez nesto.','letter',offer);
 assert.equal(audit.ok,false);
 assert.match(audit.issues.join(' '),/sans être explicitement vérifiable/i);
});
test('Une ancienne expérience de stage de 3 mois ne devient pas une durée de la nouvelle alternance',()=>{
 const txt="J'ai effectué un stage de 3 mois en 2025. Je souhaite vous rejoindre chez nesto.";
 assert.equal(targetedContractDurations(txt,'letter').length,0);
 assert.equal(validateDraft(txt,'letter',job).ok,true);
});
test('Une modification de l’offre rend les documents précédemment associés caducs',()=>{
 assert.throws(()=>assertApplicationPair(bundle(),{...job,company:'Autre Entreprise'}),/version actuelle/i);
});
test('Deux CV et lettre associées à deux offres différentes ne peuvent pas être validés ensemble',()=>{
 const stale=bundle({letterTargetSignature:targetSignature({...job,company:'ICDC'})});
 assert.throws(()=>assertApplicationPair(stale,job),/pas tous liés/i);
});
test('Les anciens documents sans signatures ne sont pas envoyés silencieusement',()=>{
 assert.throws(()=>assertApplicationPair({cv,letter},job),/version actuelle/i);
});
test('Le CV ne répète pas les coordonnées complètes déjà ajoutées dans l’en-tête',()=>{
 const profile={name:'Camille Dupont',email:'camille@example.org',location:'Paris',phone:'0600000000'};
 const text=`Camille Dupont\ncamille@example.org · 0600000000 · Paris\nProfil\nDéveloppeuse web.`;
 const blocks=cvBlocks(text,profile);
 assert.equal(blocks.filter(x=>x.type==='contact').length,1);
 assert.equal(blocks.filter(x=>/camille@example.org/.test(x.text)).length,1);
});
test('La lettre exportée garde un objet tiré de l’offre plutôt qu’un ancien objet du modèle',()=>{
 const blocks=letterBlocks('Objet : Candidature pour ICDC\nMadame, Monsieur,\nJe postule chez nesto.',{name:'Camille Dupont'},job);
 assert.equal(blocks.filter(x=>x.type==='subject').length,1);
 assert.match(blocks.find(x=>x.type==='subject').text,/Développeur full stack.*nesto/);
 assert.doesNotMatch(blocks.find(x=>x.type==='subject').text,/ICDC/);
});
test('La date ATS est attachée à un champ publié officiel ; updated_at ne sert pas de publication',()=>{
 const lever={atsId:'lever',slug:'nesto',name:'Lever',endpoint:'https://api.lever.co/v0/postings/nesto'};
 const a=normalizeBoardJob({text:'Développeur full stack',hostedUrl:'https://jobs.lever.co/nesto/123',categories:{location:'Paris'},publishedAt:'2026-09-21',createdAt:1790000000000},lever);
 assert.equal(a.publishedAt,'2026-09-21');
 assert.match(a.publicationEvidence,/Date annoncée par API Lever/);
 const createdOnly=normalizeBoardJob({text:'Développeur',hostedUrl:'https://jobs.lever.co/nesto/124',createdAt:1790000000000},lever);
 assert.equal(createdOnly.publishedAt,'');
 const greenhouse={atsId:'greenhouse',slug:'nesto',name:'Greenhouse',endpoint:'https://boards-api.greenhouse.io/v1/boards/nesto/jobs'};
 const b=normalizeBoardJob({title:'Développeur full stack',absolute_url:'https://boards.greenhouse.io/nesto/jobs/123',updated_at:'2026-10-01'},greenhouse);
 assert.equal(b.publishedAt,'');
 assert.equal(b.publicationEvidence,'');
});
test('La date publiée issue de l’API évite un scraping réseau inutile',async()=>{
 let calls=0;
 const result=await verifyJobDate({url:'https://example.org/job/123',title:'Développeur',publishedAt:'2026-10-10',publicationEvidence:'Date annoncée par API Lever'},{fetchPage:()=>{calls++;throw new Error('Must not be called');}});
 assert.equal(result.dateCheckStatus,'verified');
 assert.equal(calls,0);
});
test('Contrôles UI superflus masqués et crédit réservé à À propos',()=>{
 const ui=source('renderer/app.js'),css=source('renderer/style.css'),main=source('electron/main.cjs');
 assert.match(ui,/value\.hidden=unused/);
 assert.match(ui,/mode\.hidden=!keyword/);
 assert.match(css,/input\[name="value"\]\[hidden\]/);
 assert.doesNotMatch(ui,/class="creator-credit"/);
 assert.match(ui,/Créé et développé par <strong>Akasche MAHINTAN/);
 assert.match(main,/assertApplicationPair\(state\.outputs\[job\.id\],job\)/);
 assert.match(ui,/!job\.draftVerified/);
});
test('Import de CV ambigu demande confirmation plutôt qu’une fusion tacite de profils',()=>{
 const main=source('electron/main.cjs');
 assert.match(main,/Le CV a changé, mais AlterRADAR ne peut pas confirmer/);
 assert.match(main,/Autre candidat : archiver et repartir/);
});
