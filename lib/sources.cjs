'use strict';
/** AlterRADAR's automatic multi-source discovery. All URL origins are hardcoded, not user supplied. */
const { validateHttpsUrl, clean, relevantJob } = require('./domain.cjs');

const SOURCES = Object.freeze([
  {id:'alternancestech',name:'Alternances Tech France (communauté)',auth:'none',region:'France',note:'Liste ouverte, tech uniquement ; liens directs et données issues d’agrégateurs, couverture limitée'},
  {id:'arbeitnow',name:'Arbeitnow',auth:'none',region:'Europe',note:'Flux européen, plusieurs ATS, sans compte'},
  {id:'remotive',name:'Remotive',auth:'none',region:'International',note:'Offres à distance ; actualisation limitée à 4 fois par jour'},
  {id:'jobicy',name:'Jobicy',auth:'none',region:'International',note:'Offres à distance récentes (fenêtre API de 7 jours)'},
  {id:'himalayas',name:'Himalayas',auth:'none',region:'International',note:'Offres à distance ; attribution obligatoire'},
  {id:'remoteok',name:'Remote OK',auth:'none',region:'International',note:'Offres à distance ; attribution obligatoire'},
  {id:'themuse',name:'The Muse',auth:'none',region:'International',note:'Stages et emplois internationaux'},
  {id:'francetravail',name:'France Travail',auth:'oauth',region:'France',note:'API officielle, inscription gratuite et identifiants OAuth requis'},
  {id:'adzuna',name:'Adzuna France',auth:'keypair',region:'France',note:'Identifiants gratuits app_id et app_key requis'},
  {id:'jooble',name:'Jooble France',auth:'key',region:'France',note:'Clé régionale requise ; quota gratuit limité à 500 appels sur la durée de vie'},
  {id:'labonnealternance',name:'La Bonne Alternance',auth:'key',region:'France',note:'Source facultative, désactivée par défaut ; clé API requise'}
]);
const DEFAULT_ENABLED = Object.freeze(['alternancestech','arbeitnow','remotive','jobicy','himalayas','remoteok','themuse']);
const DEFAULT_COOLDOWN_MINUTES = Object.freeze({alternancestech:360,remotive:360,jobicy:60,himalayas:60,remoteok:120,themuse:120,arbeitnow:60,francetravail:60,adzuna:60,jooble:720,labonnealternance:120});
const htmlToText = value => String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const safe = (value,n=12000) => clean(htmlToText(value),n);
const asArray = value => Array.isArray(value)?value:[];
function normalizeJob(input, source) {
  if (!input || !input.title || !input.url) return null;
  let url;
  try { url = validateHttpsUrl(input.url); } catch { return null; }
  return {
    title: safe(input.title,230), company:safe(input.company || 'Entreprise non précisée',150),
    location:safe(input.location,180),url,description:safe(input.description,12000),
    source, publisher:safe(input.publisher || '',150),
    applicationEmail:safe(input.applicationEmail||'',200),
    recruiterLinkedin: input.recruiterLinkedin || '',
    publishedAt: input.publishedAt || ''
  };
}
/** Lit uniquement les liens d'annonces de la liste communautaire, sans GitHub token.
 *  Les lignes peuvent ne plus être à jour ; elles restent sujettes aux règles du candidat. */
function parseCommunityMarkdown(markdown){
  const jobs=[];
  for(const line of String(markdown||'').split(/\r?\n/)){
    if(!/^\s*\|?\s*[^|]+\s*\|/.test(line) || !/\[Postuler[^\]]*\]\(https:\/\/[^)]+\)/i.test(line)) continue;
    const cols=line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/\s*\|\s*/);
    if(cols.length<7)continue;
    const [company,title,city,contract,start,level,apply]=cols;
    const match=apply.match(/\[Postuler[^\]]*\]\((https:\/\/[^\s)]+)\)/i);
    if(!match)continue;
    jobs.push({title:String(title).replace(/🆕|🏠|🔒/g,'').trim(),company:company.trim(),location:city.trim(),
      description:`${title}. ${contract}. Niveau indiqué : ${level}. Début : ${start}. Source communautaire (vérifier qu’il s’agit bien d’une alternance active).`,
      url:match[1],publisher:'',publishedAt:''});
  }
  return jobs;
}
async function textRequest(url,fetchImpl=fetch){
  const res=await fetchImpl(url,{signal:AbortSignal.timeout(18000),redirect:'error',headers:{'Accept':'text/plain','User-Agent':'AlterRADAR/0.7 (+https://github.com/akshiiGIT/AlterRADAR)'}});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const body=await res.text();
  if(body.length>2_000_000)throw new Error('Flux trop volumineux');
  return body;
}
async function jsonRequest(url,options={},fetchImpl=fetch){
  const res=await fetchImpl(url,{...options,signal:AbortSignal.timeout(18000),redirect:'error',headers:{'Accept':'application/json','User-Agent':'AlterRADAR/0.6 (+https://github.com/akshiiGIT/AlterRADAR)',...(options.headers||{})}});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return res.json();
}
const result = (payload, source, mapper) => asArray(payload).map(x=>{try{return normalizeJob(mapper(x),source)}catch{return null}}).filter(Boolean);
function roleTerms(profile){return String(profile?.roles||'').split(/[,;\n]/).map(x=>x.trim()).filter(x=>x.length>2).slice(0,3);}
function searchTerms(profile,searchTypes=['alternance']){
  const types=require('./contracts.cjs').normalizeTypes(searchTypes);
  // Requêtes ciblées EN PREMIER. L'ancienne implémentation envoyait surtout
  // « alternance » tout court, ramenant RH, commerce, etc.
  const raw=roleTerms(profile);
  const roles=(raw.length?raw:require('./matching.cjs').suggestedJobs(profile,3)).slice(0,3);
  const terms=types.flatMap(type=>roles.length?roles.map(role=>`${type} ${role}`):[type]);
  return [...new Set(terms)].slice(0,6);
}
const location = p => String(p?.location||'').trim().slice(0,70);
async function fetchProvider(id,ctx={}) {
  const {profile={},credentials={},fetchImpl=fetch,searchTypes=['alternance']}=ctx;
  const get=(u,opt)=>jsonRequest(u,opt,fetchImpl);
  if(id==='alternancestech'){
    const text=await textRequest('https://raw.githubusercontent.com/Dymayo/alternances-tech-2026/main/README.md',fetchImpl);
    return result(parseCommunityMarkdown(text),'Alternances Tech France',j=>j);
  }
  if(id==='arbeitnow'){
    const batches=await Promise.all([1,2].map(page=>get(`https://www.arbeitnow.com/api/job-board-api?page=${page}`)));
    return batches.flatMap(p=>result(p.data,'Arbeitnow',j=>({title:j.title,company:j.company_name,description:j.description,location:j.location,url:j.url,publishedAt:j.created_at})));
  }
  if(id==='remotive'){
    const p=await get('https://remotive.com/api/remote-jobs?limit=200');
    return result(p.jobs,'Remotive',j=>({title:j.title,company:j.company_name,location:j.candidate_required_location,description:j.description,url:j.url,publishedAt:j.publication_date}));
  }
  if(id==='jobicy'){
    const p=await get('https://jobicy.com/api/v2/remote-jobs?count=200');
    return result(p.jobs,'Jobicy',j=>({title:j.jobTitle,company:j.companyName,location:j.jobGeo,description:j.jobDescription,url:j.url,publishedAt:j.pubDate}));
  }
  if(id==='himalayas'){
    const pages=await Promise.all([0,20,40].map(offset=>get(`https://himalayas.app/jobs/api?limit=20&offset=${offset}`)));
    return pages.flatMap(p=>result(p.jobs,'Himalayas',j=>({title:j.title,company:j.companyName||j.company?.name,location:asArray(j.locationRestrictions).join(', ')||j.location||'Remote',description:j.description,url:j.applicationLink||j.guid,publishedAt:j.pubDate||j.publishedAt})));
  }
  if(id==='remoteok'){
    const p=await get('https://remoteok.com/api');
    return result(p,'Remote OK',j=>({title:j.position,company:j.company,location:j.location||'Remote',description:j.description,url:j.url,publishedAt:j.date}));
  }
  if(id==='themuse'){
    const pages=await Promise.all([0,1,2].map(page=>get(`https://www.themuse.com/api/public/jobs?page=${page}&level=Internship`)));
    return pages.flatMap(p=>result(p.results,'The Muse',j=>({title:j.name,company:j.company?.name,location:asArray(j.locations).map(x=>x.name).join(', '),description:j.contents,url:j.refs?.landing_page,publishedAt:j.publication_date})));
  }
  if(id==='francetravail'){
    const {clientId,clientSecret}=credentials;const scope=credentials.scope||'api_offresdemploiv2 o2dsoffre';
    if(!clientId||!clientSecret)throw new Error('Identifiants OAuth France Travail non configurés');
    const tokenUrl='https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
    const form=new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret,scope});
    const tk=await get(tokenUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form.toString()});
    if(!tk.access_token)throw new Error('Jeton France Travail non fourni');
    const queries=searchTerms(profile,searchTypes).slice(0,3);
    const pages=await Promise.all(queries.map(async term=>{
      const params=new URLSearchParams({motsCles:term,range:'0-149'});
      const endpoint=`https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params}`;
      return get(endpoint,{headers:{Authorization:`Bearer ${tk.access_token}`}});
    }));
    return pages.flatMap(p=>result(p.resultats,'France Travail',j=>({title:j.intitule,company:j.entreprise?.nom||j.entreprise?.description,location:j.lieuTravail?.libelle,description:j.description,url:String(j.origineOffre?.urlOrigine||'').startsWith('https://')?j.origineOffre.urlOrigine:`https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(j.id)}`,publishedAt:j.dateCreation,applicationEmail:j.contact?.courriel})).map(j=>({...j,source:'France Travail'})));
  }
  if(id==='adzuna'){
    if(!credentials.appId||!credentials.appKey)throw new Error('Identifiants Adzuna non configurés');
    const pages=await Promise.all(searchTerms(profile,searchTypes).slice(0,3).map(async term=>{
      const q=new URLSearchParams({app_id:credentials.appId,app_key:credentials.appKey,results_per_page:'50',what:term,...(location(profile)?{where:location(profile)}:{})});
      return get(`https://api.adzuna.com/v1/api/jobs/fr/search/1?${q}`);
    }));
    return pages.flatMap(p=>result(p.results,'Adzuna',j=>({title:j.title,company:j.company?.display_name,description:j.description,location:j.location?.display_name,url:j.redirect_url,publishedAt:j.created})));
  }
  if(id==='jooble'){
    if(!credentials.apiKey)throw new Error('Clé Jooble France non configurée');
    const term=searchTerms(profile,searchTypes)[0];
    const p=await get(`https://fr.jooble.org/api/${encodeURIComponent(credentials.apiKey)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({keywords:term,location:location(profile),page:1})});
    return result(p.jobs,'Jooble',j=>({title:j.title,company:j.company,location:j.location,description:j.snippet,url:j.link,publishedAt:j.updated}));
  }
  if(id==='labonnealternance'){
    if(!credentials.apiKey)throw new Error('Clé La Bonne Alternance non configurée');
    const p=await get('https://api.apprentissage.beta.gouv.fr/api/job/v1/search',{headers:{Authorization:`Bearer ${credentials.apiKey}`}});
    return result(p.jobs,'La Bonne Alternance',j=>({title:j.offer?.title||j.title,company:j.workplace?.name||j.company?.name,description:j.offer?.description||j.description,location:j.workplace?.location?.address||j.location,url:j.application?.url||j.url}));
  }
  throw new Error('Source inconnue');
}
function validSourceIds(ids){const valid=new Set(SOURCES.map(x=>x.id));return [...new Set(asArray(ids).filter(x=>typeof x==='string'&&valid.has(x)))];}
function migrateEnabledSources(ids){
  const oldDefault=['arbeitnow','remotive','jobicy','himalayas','remoteok','themuse'];
  const current=validSourceIds(ids);
  // Add the new French default only when the user had not customized the previous defaults.
  return current.length===oldDefault.length && oldDefault.every(x=>current.includes(x))
    ?['alternancestech',...oldDefault] : current;
}
async function searchAll({profile={},enabled=DEFAULT_ENABLED,credentials={},searchTypes=['alternance'],lastRuns={},force=false,fetchImpl=fetch,now=Date.now()}={}) {
  const sources=validSourceIds(enabled);const summaries=[];const jobs=[];
  await Promise.all(sources.map(async id=>{
    const elapsed=now-(Date.parse(lastRuns[id])||0);
    const cooldown=(DEFAULT_COOLDOWN_MINUTES[id]||60)*60000;
    if(!force && elapsed>=0 && elapsed<cooldown){summaries.push({id,status:'skipped',count:0,reason:'Prochaine actualisation programmée'});return;}
    try{
      const found=await fetchProvider(id,{profile,credentials:credentials[id]||{},fetchImpl,searchTypes});
      jobs.push(...found);
      summaries.push({id,status:'ok',count:found.length,at:new Date(now).toISOString()});
    }catch(err){summaries.push({id,status:'error',count:0,reason:String(err.message).slice(0,120)});}
  }));
  const rank=new Map(sources.map((s,i)=>[s,i]));summaries.sort((a,b)=>rank.get(a.id)-rank.get(b.id));
  return {jobs,sources:summaries};
}
module.exports={SOURCES,DEFAULT_ENABLED,DEFAULT_COOLDOWN_MINUTES,normalizeJob,fetchProvider,searchAll,validSourceIds,htmlToText,parseCommunityMarkdown,migrateEnabledSources,searchTerms};
