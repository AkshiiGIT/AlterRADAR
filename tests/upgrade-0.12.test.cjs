'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {profileEducationCheck,evaluateJob}=require('../lib/rules.cjs');
const {mergeDiscovered}=require('../lib/discovery.cjs');
const {allowedModel,QWEN_CATALOG}=require('../lib/ollama.cjs');
const creator=require('../config/creator.json');

test('Bac+3 exclut automatiquement Bac+4/5 même si la règle historique est désactivée',()=>{
 const profile={level:'3',roles:'développeur full stack',skills:'JavaScript PHP'};
 const off={title:'Alternant Bac + 4 - Bac + 5 Développeur IA H/F',description:'Développement web PHP en apprentissage',score:95};
 const disabled=[{id:'education-default',field:'education',value:'3',enabled:false}];
 assert.equal(evaluateJob(off,profile,disabled,{strictProfileEducation:true}).eligible,false);
 assert.match(evaluateJob(off,profile,disabled,{strictProfileEducation:true}).reasons.join(' '),/Bac\+4/);
 assert.equal(evaluateJob(off,profile,disabled,{strictProfileEducation:false}).eligible,true);
 assert.equal(profileEducationCheck({...off,title:'Développeur JavaScript Bac+3'},profile).eligible,true);
});

test('le titre explicite prévaut sur une mention Bac+3 dans la description',()=>{
 const result=profileEducationCheck({title:'Alternance Bac+5 développeur',description:'Un membre de notre équipe possède un diplôme Bac+3'}, {level:'3'});
 assert.equal(result.eligible,false);
 assert.equal(result.required,5);
});

test('une offre trop diplômée est rejetée avant insertion dans la recherche automatique',()=>{
 const offers=[
  {title:'Alternant Bac+5 Développeur React',company:'Entreprise A',description:'Apprentissage React et JavaScript',url:'https://example.com/a'},
  {title:'Alternance développeur React Bac+3',company:'Entreprise B',description:'Apprentissage React et JavaScript',url:'https://example.com/b'}
 ];
 const result=mergeDiscovered([],offers,{profile:{level:'3',roles:'développeur web',skills:'React JavaScript'},rules:[],strictCareer:false,searchTypes:['alternance'],strictProfileEducation:true});
 assert.equal(result.jobs.length,1);
 assert.match(result.jobs[0].title,/Bac\+3/);
});

test('liste blanche Qwen et choix du modèle local protègent des noms arbitraires',()=>{
 assert.equal(QWEN_CATALOG.length,6);
 assert.equal(allowedModel('qwen2.5:7b'),true);
 assert.equal(allowedModel('qwen2.5-coder:7b'),true);
 assert.equal(allowedModel('../../command'),false);
 assert.equal(allowedModel('rm -rf ~'),false);
});

test('liens créateur : GitHub, LinkedIn et mail professionnel',()=>{
 assert.equal(creator.linkedinUrl,'https://www.linkedin.com/in/akasche-mahintan');
 assert.match(creator.repositoryUrl,/AkshiiGIT|akshiiGIT/i);
 assert.match(creator.email,/@/);
});

test('compteur de la sidebar est calculé à partir des mêmes offres éligibles que la page',()=>{
 const ui=fs.readFileSync(path.join(root,'renderer/app.js'),'utf8');
 assert.match(ui,/function shownJobs\(\)/);
 assert.match(ui,/const compatible=shownJobs\(\)\.length/);
 assert.match(ui,/const filtered=shownJobs\(\)/);
 assert.match(ui,/\$\{compatible\}<\/span>/);
 assert.match(ui,/analysées ·/);
});

test('apparence personnalisée : contrôles, CSS et endpoints locaux',()=>{
 const ui=fs.readFileSync(path.join(root,'renderer/app.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'renderer/style.css'),'utf8');
 const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
 const preload=fs.readFileSync(path.join(root,'electron/preload.cjs'),'utf8');
 for(const id of ['appearance-style','wallpaper-mode','glass-tint','glass-intensity','reduce-effects'])assert.match(ui,new RegExp(id));
 assert.match(css,/backdrop-filter:blur/);
 assert.match(css,/data-appearance="tinted"/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(main,/app:wallpaper-import/);
 assert.match(main,/app:wallpaper-clear/);
 assert.match(main,/8\*1024\*1024/);
 assert.match(preload,/wallpaperImport/);
 assert.match(ui,/data-action="install-catalog-model"/);
});
