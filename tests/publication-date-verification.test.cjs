'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {extractPublication,verifyJobDate,parsePublishedDate,permittedUrl,publicIPv4,checkAiEvidence,titleMatches}=require('../lib/publication-date.cjs');
const root=path.join(__dirname,'..');
const src=f=>fs.readFileSync(path.join(root,f),'utf8');

test('Date de publication lue directement dans le Schema.org JobPosting de la bonne offre',async()=>{
 const html=`<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","title":"Designer UX","datePosted":"2026-10-01"},{"@type":"JobPosting","title":"Développeur Full-stack H/F","datePosted":"2026-10-12T09:00:00Z"}]}</script>`;
 assert.deepEqual(extractPublication(html,{jobTitle:'Développeur Full-stack H/F'}),{date:'2026-10-12',evidence:'Schema.org JobPosting.datePosted'});
 const verified=await verifyJobDate({url:'https://boards.greenhouse.io/demo/jobs/1',title:'Développeur Full-stack H/F'},{fetchPage:async()=>html});
 assert.equal(verified.publishedAt,'2026-10-12');assert.equal(verified.dateCheckStatus,'verified');
});
test('Aucune date attribuée quand le JobPosting appartient à une autre offre',()=>{
 const html='<script type="application/ld+json">{"@type":"JobPosting","title":"Commercial senior","datePosted":"2026-10-11"}</script>';
 assert.equal(extractPublication(html,{jobTitle:'Développeur Full-stack H/F'}).date,'');
 assert.equal(titleMatches('Commercial senior','Développeur Full-stack H/F'),false);
});
test('Un champ dateModified et une date de début ne sont jamais interprétés comme une publication',()=>{
 const page='<script type="application/ld+json">{"@type":"JobPosting","title":"Développeur","dateModified":"2026-10-14","validThrough":"2026-11-20","employmentType":"INTERN"}</script><p>Début de mission le 15/10/2026</p>';
 assert.equal(extractPublication(page,{jobTitle:'Développeur'}).date,'');
});
test('Métadonnées et date de publication visible acceptées, sans lire les dates non qualifiées',()=>{
 assert.equal(extractPublication('<meta content="2026-10-09" itemprop="datePosted">').date,'2026-10-09');
 assert.equal(extractPublication('<p>Publié le 12 octobre 2026</p>').date,'2026-10-12');
 assert.equal(extractPublication('<time itemprop="datePosted" datetime="2026-10-03">Oct.</time>').date,'2026-10-03');
 assert.equal(extractPublication('<p>Published on October 12, 2026</p>').date,'2026-10-12');
 assert.equal(extractPublication('<p>Poste à pourvoir à partir du 12 octobre 2026</p>').date,'');
});
test('Dates impossibles, futures et texte arbitraire refusés',()=>{
 assert.equal(parsePublishedDate('31/02/2026'),'');
 assert.equal(parsePublishedDate('15/08/2027'),'');
 assert.equal(parsePublishedDate('2026-10-01'),'2026-10-01');
 assert.equal(parsePublishedDate('not a date'),'');
});
test('IA : seule une citation réellement présente avec une date vérifiable est acceptée',()=>{
 const excerpt='Published on 2026-10-12';
 assert.equal(checkAiEvidence(JSON.stringify({date:'2026-10-12',evidence:excerpt}),excerpt).date,'2026-10-12');
 assert.equal(checkAiEvidence(JSON.stringify({date:'2026-10-10',evidence:excerpt}),excerpt),null);
 assert.equal(checkAiEvidence(JSON.stringify({date:'2026-10-12',evidence:'Published on 2026-10-12'}),'nothing'),null);
});
test('Pages HTTPS publiques uniquement : pas de localhost, IP privée ou identifiants',()=>{
 for(const address of ['https://localhost/a','http://example.com/a','https://127.0.0.1/a','https://admin:secret@example.com/a','https://evil.local/a','https://example.com:444/a'])assert.throws(()=>permittedUrl(address));
 for(const address of ['127.0.0.1','10.2.1.3','172.25.0.1','169.254.1.1','192.168.1.20','100.64.0.1'])assert.equal(publicIPv4(address),false);
 assert.equal(publicIPv4('8.8.8.8'),true);
 assert.equal(permittedUrl('https://jobs.lever.co/demo/1').hostname,'jobs.lever.co');
});
test('En cas de blocage HTTP, aucune date de publication n’est inventée',async()=>{
 const job={url:'https://jobs.lever.co/exemple/1',title:'Développeur'};
 const result=await verifyJobDate(job,{fetchPage:async()=>{throw new Error('HTTP 403');}});
 assert.equal(result.dateCheckStatus,'error');assert.equal(result.publishedAt,'');
 assert.equal((await verifyJobDate(job,{fetchPage:async()=>'<p>Offre intéressante.</p>'})).dateCheckStatus,'unavailable');
});
test('Le scan déclenche la vérification asynchrone et propose un contrôle manuel',()=>{
 const main=src('electron/main.cjs'),renderer=src('renderer/app.js'),preload=src('electron/preload.cjs');
 assert.match(main,/setImmediate\(\(\)=>checkPublicationQueue\(\)/);
 assert.match(main,/checkPublicationOne/);
 assert.match(preload,/verifyJobDate:/);
 assert.match(renderer,/Vérifier sur le site/);
 assert.doesNotMatch(renderer,/Repérée le/);
});
test('L’ordre récent ne fabrique pas de date avec la date de découverte',()=>{
 const {sortJobs}=require('../renderer/job-sort.js');
 const sorted=sortJobs([{id:'a',score:70,addedAt:'2026-10-15'},{id:'b',score:30,publishedAt:'2026-10-10'}],'recent');
 assert.deepEqual(sorted.map(x=>x.id),['b','a']);
});
