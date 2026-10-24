'use strict';
/**
 * Public ATS detection / board expansion for AlterRADAR.
 * Recognition is NOT a guarantee of a publicly accessible API or automated application.
 * Never attempt to infer account slugs from company names, enumerate hosts, bypass login,
 * or scrape pages that forbid automated access.
 */
const {validateHttpsUrl,clean}=require('./domain.cjs');
const {parsePublishedDate}=require('./publication-date.cjs');
const hostMatches=(host,domain)=>host===domain||host.endsWith('.'+domain);
const CATALOG=Object.freeze([
  {id:'workday',name:'Workday Recruiting',domains:['myworkdayjobs.com','myworkdaysite.com'],discovery:'public-api'},
  {id:'greenhouse',name:'Greenhouse',domains:['greenhouse.io','grnh.se'],discovery:'public-api'},
  {id:'taleo',name:'Oracle Taleo',domains:['taleo.net','oraclecloud.com'],discovery:'site-specific'},
  {id:'successfactors',name:'SAP SuccessFactors Recruiting',domains:['successfactors.com','successfactors.eu','successfactors.cn'],discovery:'site-specific'},
  {id:'icims',name:'iCIMS',domains:['icims.com','icims.eu'],discovery:'site-specific'},
  {id:'smartrecruiters',name:'SmartRecruiters',domains:['smartrecruiters.com','smartrecruiters.eu'],discovery:'public-api'},
  {id:'lever',name:'Lever',domains:['lever.co'],discovery:'public-api'},
  {id:'ashby',name:'Ashby',domains:['ashbyhq.com'],discovery:'public-api'},
  {id:'bullhorn',name:'Bullhorn',domains:['bullhornstaffing.com','bullhorn.com'],discovery:'site-specific'},
  {id:'avature',name:'Avature',domains:['avature.net','avature.com'],discovery:'site-specific'},
  {id:'flatchr',name:'Flatchr',domains:['flatchr.io','flatchr.com'],discovery:'site-specific'},
  {id:'taleez',name:'Taleez',domains:['taleez.com','taleez.fr'],discovery:'site-specific'},
  {id:'beetween',name:'Beetween',domains:['beetween.fr','beetween.com'],discovery:'site-specific'},
  {id:'wttj',name:'Welcome to the Jungle Solutions ATS',domains:['welcometothejungle.com','welcometothejungle.fr'],discovery:'site-specific'},
  {id:'softgarden',name:'Softgarden',domains:['softgarden.io','softgarden.de'],discovery:'site-specific'},
  {id:'jobaffinity',name:'Jobaffinity',domains:['jobaffinity.fr','jobaffinity.com'],discovery:'site-specific'},
  {id:'werecruit',name:'WeRecruit',domains:['werecruit.io','werecruit.com','werecruit.fr'],discovery:'site-specific'},
  {id:'teamtailor',name:'Teamtailor',domains:['teamtailor.com'],discovery:'public-api'},
  {id:'recruitee',name:'Recruitee (Tellent)',domains:['recruitee.com'],discovery:'public-api'},
  {id:'layan',name:'Layan',domains:['layan.eu','layan.fr'],discovery:'site-specific'},
  {id:'tool4staffing',name:'Tool4staffing',domains:['tool4staffing.com'],discovery:'site-specific'},
  {id:'nicoka',name:'Nicoka CABS',domains:['nicoka.com'],discovery:'site-specific'},
  {id:'beehire',name:'Beehire',domains:['beehire.com','beehire.io'],discovery:'site-specific'},
  {id:'workable',name:'Workable',domains:['workable.com'],discovery:'public-api'},
  {id:'bamboohr',name:'BambooHR',domains:['bamboohr.com'],discovery:'site-specific'},
  {id:'zoho',name:'Zoho Recruit',domains:['zoho.com','zoho.eu','zoho.in'],discovery:'site-specific'},
  {id:'jazzhr',name:'JazzHR',domains:['jazzhr.com','applytojob.com'],discovery:'site-specific'},
  {id:'breezy',name:'Breezy HR',domains:['breezy.hr'],discovery:'public-api'},
  {id:'bizneo',name:'Bizneo HR',domains:['bizneo.com','bizneohr.com'],discovery:'site-specific'},
  {id:'eurecia',name:'Eurécia (Gestion des talents)',domains:['eurecia.com','eurecia.fr'],discovery:'site-specific'}
]);
const catalogById=new Map(CATALOG.map(x=>[x.id,x]));
const slugOK=s=>typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,90}$/.test(s);
const firstPath=u=>u.pathname.split('/').filter(Boolean)[0]||'';
function identifyAts(url,html=''){
  let parsed;try{parsed=new URL(validateHttpsUrl(url));}catch{return {id:null,name:'Non identifié',confidence:'none',discovery:'unknown'};}
  const host=parsed.hostname.toLowerCase();
  for(const ats of CATALOG){
    if(ats.domains.some(d=>hostMatches(host,d))){
      // Generic Oracle/Zoho marketing and general company pages are not necessarily ATS postings.
      if(ats.id==='taleo' && hostMatches(host,'oraclecloud.com')&&!/recruit|candidate|hcmui|job/i.test(parsed.pathname))continue;
      if(ats.id==='zoho' && !/recruit|careers|jobs/i.test(`${host}${parsed.pathname}`))continue;
      if(ats.id==='bullhorn'&&hostMatches(host,'bullhorn.com')&&!/jobs|career|candidate/i.test(`${host}${parsed.pathname}`))continue;
      return {id:ats.id,name:ats.name,confidence:'high',discovery:ats.discovery,via:'url'};
    }
  }
  // Links, iframes, and asset URLs on custom career sites are hints, not proof.
  // Restrict extraction to HTML tag attributes (rather than arbitrary ad text).
  const markup=String(html||'').slice(0,200_000);
  const candidates=[...markup.matchAll(/\b(?:href|src|data-src|action)\s*=\s*["']([^"']{8,1000})["']/gi)]
    .slice(0,120).map(m=>m[1]).filter(v=>/^https:\/\//i.test(v));
  for(const candidate of candidates){
    const matched=identifyAts(candidate);
    if(matched.id)return {...matched,confidence:'medium',via:'html-asset'};
  }
  return {id:null,name:'Non identifié',confidence:'none',discovery:'unknown'};
}
function boardFromUrl(value){
  let u;try{u=new URL(validateHttpsUrl(value));}catch{return null;}
  const match=identifyAts(value);const h=u.hostname.toLowerCase();let slug='';let endpoint='';
  switch(match.id){
    case 'workday': {
      const m=h.match(/^([a-z0-9_-]+)\.wd[0-9]+\.myworkdayjobs\.com$/i);
      if(!m)return null;
      const tenant=m[1];
      const apiPath=u.pathname.match(/^\/wday\/cxs\/([^/]+)\/([^/]+)\/jobs$/);
      const segments=u.pathname.split('/').filter(Boolean);
      const site=apiPath?apiPath[2]:segments[0]?.match(/^[a-z]{2}-[A-Z]{2}$/)?segments[1]:segments[0];
      if(!slugOK(tenant)||!slugOK(site)||(apiPath&&apiPath[1]!==tenant))return null;
      slug=tenant;endpoint=`https://${h}/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}/jobs`;
      return {atsId:match.id,name:match.name,slug,site,lang:segments[0]?.match(/^[a-z]{2}-[A-Z]{2}$/)?segments[0]:'en-US',host:h,endpoint,key:`${match.id}:${h}:${tenant}:${site}`};
    }
    case 'greenhouse':
      if(!['boards.greenhouse.io','job-boards.greenhouse.io','boards-api.greenhouse.io'].includes(h))return null;
      slug=h==='boards-api.greenhouse.io'?u.pathname.match(/^\/v1\/boards\/([^/]+)/)?.[1]||'':firstPath(u);
      if(slugOK(slug))endpoint=`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
      break;
    case 'lever':
      if(!['jobs.lever.co','jobs.eu.lever.co','api.lever.co','api.eu.lever.co'].includes(h))return null;
      slug=h.startsWith('api.')?u.pathname.match(/^\/v0\/postings\/([^/]+)/)?.[1]||'':firstPath(u);
      if(slugOK(slug))endpoint=`https://${h.includes('.eu.')?'api.eu.lever.co':'api.lever.co'}/v0/postings/${encodeURIComponent(slug)}?mode=json`;
      break;
    case 'ashby':
      if(h!=='jobs.ashbyhq.com'&&h!=='api.ashbyhq.com')return null;
      slug=h==='api.ashbyhq.com'?u.pathname.match(/^\/posting-api\/job-board\/([^/]+)/)?.[1]||'':firstPath(u);
      if(slugOK(slug))endpoint=`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`;
      break;
    case 'smartrecruiters':
      if(!['jobs.smartrecruiters.com','careers.smartrecruiters.com','api.smartrecruiters.com'].includes(h))return null;
      slug=h==='api.smartrecruiters.com'?u.pathname.match(/^\/v1\/companies\/([^/]+)/)?.[1]||'':firstPath(u);
      if(slugOK(slug))endpoint=`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100&offset=0`;
      break;
    case 'recruitee':
      if(!h.endsWith('.recruitee.com'))return null;
      slug=h.slice(0,-'.recruitee.com'.length);
      if(slugOK(slug))endpoint=`https://${slug}.recruitee.com/api/offers/`;
      break;
    case 'workable':
      if(h!=='apply.workable.com')return null;
      slug=u.pathname.startsWith('/api/v1/widget/accounts/')?u.pathname.match(/^\/api\/v1\/widget\/accounts\/([^/]+)/)?.[1]||'':firstPath(u);
      if(slugOK(slug)&&slug!=='api')endpoint=`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`;
      break;
    case 'breezy':
      if(!h.endsWith('.breezy.hr'))return null;
      slug=h.slice(0,-'.breezy.hr'.length);
      if(slugOK(slug))endpoint=`https://${slug}.breezy.hr/json`;
      break;
    case 'teamtailor':
      if(!h.endsWith('.teamtailor.com'))return null;
      slug=h.slice(0,-'.teamtailor.com'.length);
      if(slugOK(slug))endpoint=`https://${slug}.teamtailor.com/jobs.json`;
      break;
    default:return null;
  }
  return endpoint?{atsId:match.id,name:match.name,slug,endpoint,key:`${match.id}:${slug}`} : null;
}
const stripHtml=v=>String(v||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
function normalizeBoardJob(job,board){
  const b=board;let j;
  switch(b.atsId){
    case 'workday':{
      const external=String(job.externalPath||'').trim();
      let url='';
      if(external.startsWith('https://'))url=external;
      else if(external){
        const path=external.startsWith('/')?external:'/'+external;
        if(path.startsWith('/'+b.lang+'/'))url=`https://${b.host}${path}`;
        else if(path.startsWith('/'+b.site+'/'))url=`https://${b.host}/${b.lang}${path}`;
        else url=`https://${b.host}/${b.lang}/${b.site}${path}`;
      }
      j={title:job.title,company:b.slug,location:job.locationsText||job.location,description:[job.title,job.bulletFields?.join(' ')||'',job.externalDescription||''].join(' '),url,publishedAt:job.postedOn};
      break;
    }
    case 'greenhouse':j={title:job.title,company:b.slug,location:job.location?.name,description:job.content,url:job.absolute_url,updatedAt:job.updated_at};break;
    case 'lever':j={title:job.text,company:b.slug,location:job.categories?.location,description:job.descriptionPlain||job.description,url:job.hostedUrl,publishedAt:job.publishedAt||job.datePosted||''};break;
    case 'ashby':if(job.isListed===false)return null;j={title:job.title,company:b.slug,location:job.location,description:job.descriptionPlain||job.descriptionHtml||job.description,url:job.jobUrl||job.applyUrl,publishedAt:job.publishedAt};break;
    case 'smartrecruiters':j={title:job.name,company:job.company?.name||b.slug,location:[job.location?.city,job.location?.country].filter(Boolean).join(', '),description:job.jobAd?.sections?.jobDescription?.text||job.description,url:job.ref||job.applyUrl||`https://jobs.smartrecruiters.com/${encodeURIComponent(b.slug)}/${encodeURIComponent(job.id||'')}`,publishedAt:job.releasedDate};break;
    case 'recruitee':j={title:job.title,company:b.slug,location:job.location||job.city,description:job.description||job.descriptionPlain,url:job.careers_url||job.url,publishedAt:job.published_at};break;
    case 'workable':j={title:job.title,company:b.slug,location:job.location?.city||job.location?.country||job.location,description:job.description||job.full_description,url:job.url||job.application_url||job.shortlink,publishedAt:job.published_on};break;
    case 'breezy':j={title:job.name||job.title,company:b.slug,location:job.location?.name||job.location,description:job.description||job.content,url:job.url||job.link,publishedAt:job.published_date};break;
    case 'teamtailor':j={title:job.title||job.name,company:b.slug,location:job.location?.name||job.location,description:job.body||job.description,url:job.url||job.links?.self,publishedAt:job.published_at};break;
    default:return null;
  }
  if(!j.title||!j.url)return null;
  try{j.url=validateHttpsUrl(j.url)}catch{return null;}
  return {title:clean(stripHtml(j.title),230),company:clean(stripHtml(j.company),150),location:clean(stripHtml(j.location),180),description:clean(stripHtml(j.description),12000),url:j.url,publishedAt:parsePublishedDate(j.publishedAt),publicationEvidence:parsePublishedDate(j.publishedAt)?`Date annoncée par API ${b.name}`:'',updatedAt:j.updatedAt||'',source:b.name,atsId:b.atsId,atsName:b.name,originBoard:b.endpoint};
}
function unpackBoard(payload,b){
  let records=[];
  if(Array.isArray(payload))records=payload;
  else if(Array.isArray(payload?.jobs))records=payload.jobs;
  else if(Array.isArray(payload?.jobPostings))records=payload.jobPostings;
  else if(Array.isArray(payload?.content))records=payload.content;
  else if(Array.isArray(payload?.offers))records=payload.offers;
  else if(Array.isArray(payload?.positions))records=payload.positions;
  else if(Array.isArray(payload?.data))records=payload.data;
  else if(Array.isArray(payload?.results))records=payload.results;
  return records.slice(0,1500).map(j=>{try{return normalizeBoardJob(j,b)}catch{return null}}).filter(Boolean);
}
async function fetchPublicBoard(board,{fetchImpl=fetch,timeoutMs=18000}={}){
  // endpoint ALWAYS generated by boardFromUrl; check the exact URL before any request.
  if(!board||!board.key||boardFromUrl(board.endpoint)?.key!==board.key)throw new Error('Tableau ATS non autorisé');
  const headers={Accept:'application/json','User-Agent':require('./domain.cjs').USER_AGENT};
  if(board.atsId==='workday'){
    const collected=[];
    for(let offset=0;offset<200;offset+=20){
      const response=await fetchImpl(board.endpoint,{method:'POST',headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({appliedFacets:{},limit:20,offset,searchText:''}),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const payload=await response.json();const postings=Array.isArray(payload?.jobPostings)?payload.jobPostings:[];
      collected.push(...unpackBoard(payload,board));
      if(postings.length<20||offset+20>=Number(payload.total||0))break;
    }
    return collected;
  }
  const response=await fetchImpl(board.endpoint,{headers,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const payload=await response.json();return unpackBoard(payload,board);
}
async function expandFromKnownUrls(offers,{fetchImpl=fetch,maxBoards=6,previousRuns={},now=Date.now(),cooldownMinutes=360}={}){
  const boards=[];const seen=new Set();
  for(const offer of offers||[]){
    const b=boardFromUrl(offer.url);
    if(!b||seen.has(b.key))continue;
    seen.add(b.key);
    if(now-(Date.parse(previousRuns[b.key])||0)<cooldownMinutes*60000)continue;
    boards.push(b);if(boards.length>=maxBoards)break;
  }
  const jobs=[];const reports=[];
  await Promise.all(boards.map(async b=>{
    try{const data=await fetchPublicBoard(b,{fetchImpl});jobs.push(...data);reports.push({id:b.key,status:'ok',count:data.length,at:new Date(now).toISOString()});}
    catch(err){reports.push({id:b.key,status:'error',count:0,reason:String(err.message||err).slice(0,120)});}
  }));
  return {jobs,boards:reports};
}
module.exports={CATALOG,identifyAts,boardFromUrl,normalizeBoardJob,unpackBoard,fetchPublicBoard,expandFromKnownUrls};
