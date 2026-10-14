'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {CATALOG,identifyAts,boardFromUrl,unpackBoard,fetchPublicBoard,expandFromKnownUrls}=require('../lib/ats.cjs');
const {mergeDiscovered}=require('../lib/discovery.cjs');
const samples={
  workday:'https://acme.wd3.myworkdayjobs.com/fr-FR/jobs/job/42',
  greenhouse:'https://job-boards.greenhouse.io/acme/jobs/456',
  taleo:'https://acme.taleo.net/careersection/jobs/jobdetail.ftl',
  successfactors:'https://career5.successfactors.com/career?company=acme',
  icims:'https://careers-acme.icims.com/jobs/123',
  smartrecruiters:'https://jobs.smartrecruiters.com/Acme/744',
  lever:'https://jobs.lever.co/acme/101',
  ashby:'https://jobs.ashbyhq.com/acme/abcd',
  bullhorn:'https://jobs.bullhornstaffing.com/ACME/123',
  avature:'https://acme.avature.net/careers/JobDetail/1',
  flatchr:'https://acme.flatchr.io/vacancy/42',
  taleez:'https://jobs.taleez.com/acme/offer/42',
  beetween:'https://apply.beetween.fr/jobs/123',
  wttj:'https://www.welcometothejungle.com/fr/companies/acme/jobs',
  softgarden:'https://acme.softgarden.io/job/123',
  jobaffinity:'https://www.jobaffinity.fr/apply/123',
  werecruit:'https://acme.werecruit.io/offre/123',
  teamtailor:'https://acme.teamtailor.com/jobs/123',
  recruitee:'https://acme.recruitee.com/o/alternance',
  layan:'https://acme.layan.eu/job/123',
  tool4staffing:'https://app.tool4staffing.com/jobs/123',
  nicoka:'https://app.nicoka.com/jobs/123',
  beehire:'https://acme.beehire.com/jobs/123',
  workable:'https://apply.workable.com/acme/j/TEST/',
  bamboohr:'https://acme.bamboohr.com/careers/1',
  zoho:'https://recruit.zoho.eu/recruit/Job_Openings',
  jazzhr:'https://acme.applytojob.com/apply/123',
  breezy:'https://acme.breezy.hr/p/123',
  bizneo:'https://jobs.bizneo.com/jobs/123',
  eurecia:'https://app.eurecia.com/careers/jobs/123'
};
test('all 30 ATS vendors are recognized independently of a scraper being available',()=>{
  assert.equal(CATALOG.length,30);assert.deepEqual(new Set(CATALOG.map(x=>x.id)).size,30);
  for(const [id,url] of Object.entries(samples)){
    const found=identifyAts(url);
    assert.equal(found.id,id,`${id} URL ${url} -> ${found.id}`);
    assert.equal(found.confidence,'high');
  }
});
test('exact-domain matching never matches deceptive lookalikes, credentials, or HTTP',()=>{
  for(const url of ['https://jobs.lever.co.evil.example/acme/1','https://evil-greenhouse.io.example.org/a','http://jobs.lever.co/acme/1','https://user:pass@jobs.ashbyhq.com/acme/1']){
    assert.equal(identifyAts(url).id,null,url);
    assert.equal(boardFromUrl(url),null);
  }
  assert.equal(identifyAts('https://www.oraclecloud.com/').id,null);
});
test('custom employer domains may get medium-confidence HTML signals, not made-up integrations',()=>{
  const result=identifyAts('https://recrutement.exemple.fr/jobs/23','<script src="https://jobs.lever.co/acme/static.js"></script>');
  assert.equal(result.id,'lever');assert.equal(result.confidence,'medium');
  assert.equal(boardFromUrl('https://recrutement.exemple.fr/jobs/23'),null);
});
test('public board API URLs are derived only from valid, recognizable employer-hosted URLs',()=>{
  const ids=['workday','greenhouse','lever','ashby','smartrecruiters','workable','recruitee','breezy','teamtailor'];
  for(const id of ids){
    const board=boardFromUrl(samples[id]);assert.ok(board,id);assert.equal(board.atsId,id);assert.equal(boardFromUrl(board.endpoint)?.key,board.key);
  }
  assert.equal(boardFromUrl('https://jobs.ashbyhq.com/%2Fetc%2Fpasswd/1'),null);
  assert.equal(boardFromUrl('https://jobs.smartrecruiters.com/acme.evil.example/1'),null);
});
test('public ATS board posts are normalized without fabricated recruiter contacts',()=>{
  const b=boardFromUrl(samples.ashby);
  const out=unpackBoard({jobs:[{title:'Alternance analyste sécurité',jobUrl:'https://jobs.ashbyhq.com/acme/a1',descriptionPlain:'Alternance Bac+3',location:'Paris',isListed:true},{title:'Hidden',jobUrl:'https://jobs.ashbyhq.com/acme/a2',isListed:false}]},b);
  assert.equal(out.length,1);assert.equal(out[0].atsName,'Ashby');assert.equal(out[0].description,'Alternance Bac+3');
  assert.equal(out[0].applicationEmail,undefined);
  const combined=mergeDiscovered([],out,{onlyAlternance:true});
  assert.equal(combined.jobs[0].atsId,'ashby');
});
test('board expansion auto-discovers extra jobs, bounded by board count and cooldown',async()=>{
  const visited=[];
  const f=async endpoint=>{visited.push(endpoint);return {ok:true,json:async()=>({jobs:[{title:'Alternance développeur',jobUrl:'https://jobs.ashbyhq.com/acme/j2',descriptionPlain:'Alternance BAC+3'}]})};};
  const input=[{url:'https://jobs.ashbyhq.com/acme/j1'},{url:'https://jobs.ashbyhq.com/acme/j3'}];
  const r=await expandFromKnownUrls(input,{fetchImpl:f,maxBoards:3});
  assert.equal(r.jobs.length,1);assert.equal(r.boards.length,1);assert.equal(visited.length,1);
  const r2=await expandFromKnownUrls(input,{fetchImpl:f,previousRuns:{'ashby:acme':new Date().toISOString()}});
  assert.equal(r2.boards.length,0);
});
test('a forged board endpoint is not fetched',async()=>{
  const b=boardFromUrl(samples.lever);b.endpoint='https://example.org/steal';
  await assert.rejects(fetchPublicBoard(b,{fetchImpl:()=>{throw Error('Must not be called')}}),/non autorisé/);
});

test('Workday public postings are fetched using a bounded POST with explicit site from the URL',async()=>{
  const b=boardFromUrl(samples.workday);const calls=[];
  const fetchImpl=async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>({total:1,jobPostings:[{title:'Alternance Analyste SecOps',locationsText:'Paris',externalPath:'/job/123',postedOn:'Hier'}]})};};
  const jobs=await fetchPublicBoard(b,{fetchImpl});
  assert.equal(calls.length,1);assert.equal(calls[0].opts.method,'POST');
  assert.equal(JSON.parse(calls[0].opts.body).limit,20);
  assert.equal(jobs[0].url,'https://acme.wd3.myworkdayjobs.com/fr-FR/jobs/job/123');
});

test('the remaining eight public integrations normalize mock job-board responses',()=>{
  const cases={
    greenhouse:{jobs:[{title:'Alternance Dev',absolute_url:'https://job-boards.greenhouse.io/acme/jobs/123',content:'Alternance'}]},
    lever:[{text:'Alternance Dev',hostedUrl:'https://jobs.lever.co/acme/123',descriptionPlain:'Alternance'}],
    smartrecruiters:{content:[{id:'123',name:'Alternance Dev',location:{city:'Paris',country:'FR'}}]},
    workable:{jobs:[{title:'Alternance Dev',url:'https://apply.workable.com/acme/j/123',description:'Alternance'}]},
    recruitee:{offers:[{title:'Alternance Dev',careers_url:'https://acme.recruitee.com/o/alternance-dev',description:'Alternance'}]},
    breezy:[{name:'Alternance Dev',url:'https://acme.breezy.hr/p/123',description:'Alternance'}],
    teamtailor:{jobs:[{title:'Alternance Dev',url:'https://acme.teamtailor.com/jobs/123',description:'Alternance'}]}
  };
  for(const [id,payload] of Object.entries(cases)){
    const board=boardFromUrl(samples[id]);const list=unpackBoard(payload,board);
    assert.equal(list.length,1,id);assert.equal(list[0].atsId,id);assert.match(list[0].title,/Alternance/);
  }
});
