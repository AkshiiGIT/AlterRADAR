'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dates=require('../lib/publication-date.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('v0.14: thème clair, sombre et verre ont leurs palettes indépendantes et accessibles',()=>{
 const css=read('renderer/liquid-ui.css'),app=read('renderer/app.js');
 assert.match(css,/body\[data-theme="light"\]/);
 assert.match(css,/body\[data-theme="dark"\]/);
 assert.match(css,/data-reduce-effects="true"/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(app,/data-action="theme-preset"/);
 assert.match(app,/aria-pressed=/);
 assert.match(app,/theme-preset'/);
 assert.match(read('renderer/index.html'),/liquid-ui\.css/);
});
test('v0.14: contrôle hover sans requête externe et avec désactivation',()=>{
 const css=read('renderer/liquid-ui.css');
 assert.match(css,/--bubble-x/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/\.btn::after/);
 assert.match(css,/\.btn:focus-visible/);
 assert.doesNotMatch(css,/@import\s|url\(['"]?https?:/);
});
test('v0.14: ne traite pas updatedAt comme une publication',async()=>{
 const result=await dates.verifyJobDate({url:'https://offres.example.com/200',title:'Développeur',updatedAt:'2026-10-12'}, {fetchPage:async()=>'<html>Dernière mise à jour : 12 octobre 2026</html>'});
 assert.equal(result.dateCheckStatus,'unavailable');assert.equal(result.publishedAt,'');
});
test('v0.14: conserve une date fournie et prouvée par une API française sans requête web',async()=>{
 let count=0;
 const result=await dates.verifyJobDate({url:'https://offres.example.com/200',publishedAt:'2026-10-11',publicationEvidence:'Date annoncée par API France Travail'}, {fetchPage:async()=>{count++;throw Error('403')}});
 assert.equal(count,0);assert.equal(result.dateCheckStatus,'verified');assert.equal(result.publishedAt,'2026-10-11');
});
test('v0.14: correspondance exacte Ashby URL + titre avant de croire publishedAt',async()=>{
 const job={url:'https://jobs.ashbyhq.com/acmecorp/5db2f431',title:'Développeur Full Stack'};
 const rows=[{jobUrl:job.url,title:job.title,publishedAt:'2026-10-08'},{jobUrl:'https://jobs.ashbyhq.com/acmecorp/other',title:job.title,publishedAt:'2026-10-14'}];
 const result=await dates.verifyJobDate(job,{fetchPage:async(url,opts)=>{
   if(opts?.responseType==='json'){assert.equal(url,'https://api.ashbyhq.com/posting-api/job-board/acmecorp');return JSON.stringify({jobs:rows});}
   throw Error('La page a refusé la connexion');
 }});
 assert.equal(result.dateCheckStatus,'verified');assert.equal(result.publishedAt,'2026-10-08');assert.match(result.publicationEvidence,/Ashby/);
});
test('v0.14: un autre job, une entreprise inconnue ou une date future ne sont pas validés',async()=>{
 const j={url:'https://jobs.ashbyhq.com/acmecorp/5db2f431',title:'Développeur Full Stack'};
 assert.equal(dates.matchAshbyPosting(j,[{jobUrl:'https://jobs.ashbyhq.com/acmecorp/other',title:j.title,publishedAt:'2026-10-13'}]),null);
 assert.equal(dates.ashbyBoardUrl('https://jobs.ashbyhq.com.attacker.tld/foo/bar'),null);
 assert.equal(dates.ashbyBoardUrl('http://jobs.ashbyhq.com/foo/bar'),null);
 const x=await dates.verifyJobDate(j,{fetchPage:async(url,opts)=>opts?.responseType==='json'?JSON.stringify({jobs:[{jobUrl:j.url,title:j.title,publishedAt:'2099-10-08'}]}):'<html>Updated 2026-10-01</html>'});
 assert.equal(x.publishedAt,'');
});
