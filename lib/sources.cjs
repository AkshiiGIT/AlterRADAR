'use strict';
/** AlterRADAR's automatic multi-source discovery. All URL origins are hardcoded, not user supplied. */
const { validateHttpsUrl, clean, relevantJob, USER_AGENT } = require('./domain.cjs');
const {normal,normalizeZones,normalizeSector,SECTORS}=require('./search-preferences.cjs');
const {pickJobRecords,jobToNormalized,validateRelayUrl}=require('./lba-gateway.cjs');
const {parsePublishedDate}=require('./publication-date.cjs');
const publicServices=require('../config/public-services.json');
const RELAY_URL=validateRelayUrl(publicServices.alternanceRelayUrl||'');
const LBA_SECTOR_ROMES=Object.freeze({software:'M1805',networks:'M1801',security:'M1801',support:'M1802',it:'M1805,M1801,M1802'});

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
  {id:'labonnealternance',name:'La Bonne Alternance',auth:'key',region:'France',note:'Offres d’apprentissage françaises. Via relais AlterRADAR lorsqu’il sera déployé, ou clé personnelle facultative.'}
]);
const DEFAULT_ENABLED = Object.freeze(['alternancestech','arbeitnow','remotive','jobicy','himalayas','remoteok','themuse',...(RELAY_URL?['labonnealternance']:[])]);
const DEFAULT_COOLDOWN_MINUTES = Object.freeze({alternancestech:5,remotive:360,jobicy:60,himalayas:60,remoteok:120,themuse:120,arbeitnow:5,francetravail:60,adzuna:60,jooble:720,labonnealternance:120});
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
    publishedAt: parsePublishedDate(input.publishedAt),
    updatedAt: parsePublishedDate(input.updatedAt), publicationEvidence:input.publishedAt?'Date annoncée par API '+source:''
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
  const res=await fetchImpl(url,{signal:AbortSignal.timeout(18000),redirect:'error',headers:{'Accept':'text/plain','User-Agent':USER_AGENT}});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const body=await res.text();
  if(body.length>2_000_000)throw new Error('Flux trop volumineux');
  return body;
}
async function jsonRequest(url,options={},fetchImpl=fetch){
  const res=await fetchImpl(url,{...options,signal:AbortSignal.timeout(18000),redirect:'error',headers:{'Accept':'application/json','User-Agent':USER_AGENT,...(options.headers||{})}});
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
// One bounded search per configured location (up to 12 per provider), with
// controlled fanout. Failed cities cannot silently become nationwide queries.
const MAX_QUERIES=12;
function places(zones=[]){return normalizeZones(zones);}
function queryPairs(terms,zones){
  if(!zones.length)return terms.slice(0,3).map(term=>({term,zone:null}));
  return terms.slice(0,3).flatMap(term=>zones.map(zone=>({term,zone}))).slice(0,MAX_QUERIES);
}
async function settledBatches(requests){
  const results=await Promise.allSettled(requests.map(fn=>fn()));
  const successes=results.filter(x=>x.status==='fulfilled').map(x=>x.value);
  const errors=results.filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason).slice(0,120));
  if(!successes.length && errors.length)throw new Error(`Aucune requête n’a réussi : ${errors[0]}`);
  return {successes,errors};
}
async function resolveCommune(city,get){
  const results=await get(`https://geo.api.gouv.fr/communes?${new URLSearchParams({nom:city,fields:'nom,code,codeDepartement',boost:'population',limit:'8'})}`);
  if(!Array.isArray(results))throw new Error('Service des communes indisponible');
  const match=results.find(c=>normal(c.nom)===normal(city));
  if(!match?.code)throw new Error(`Commune française non reconnue : ${city}`);
  return match.code;
}
function chosenTerms(profile,types,sector){
  if(!sector || sector==='all'||sector==='it')return searchTerms(profile,types);
  const selected=require('./matching.cjs').FAMILY.find(s=>s.id===sector);
  if(!selected)return searchTerms(profile,types);
  return [...new Set(require('./contracts.cjs').normalizeTypes(types).flatMap(type=>selected.suggestions.slice(0,3).map(role=>`${type} ${role}`)))].slice(0,6);
}
async function fetchProvider(id,ctx={}) {
  const {profile={},credentials={},fetchImpl=fetch,searchTypes=['alternance'],zones=[],sector='all'}=ctx;
  const geo=places(zones);const terms=chosenTerms(profile,searchTypes,sector);
  const get=(u,opt)=>jsonRequest(u,opt,fetchImpl);
  if(id==='alternancestech'){
    const text=await textRequest('https://raw.githubusercontent.com/Dymayo/alternances-tech-2026/main/README.md',fetchImpl);
    return result(parseCommunityMarkdown(text),'Alternances Tech France',j=>j);
  }
  if(id==='arbeitnow'){
    const batches=await Promise.all([1,2].map(page=>get(`https://www.arbeitnow.com/api/job-board-api?page=${page}`)));
    return batches.flatMap(p=>result(p.data,'Arbeitnow',j=>({title:j.title,company:j.company_name,description:j.description,location:j.location,url:j.url,publishedAt:j.published_at||j.datePosted||''})));
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
    const pages=[];let cursor='';
    for(let i=0;i<3;i++){
      // October 2026: this provider recommends cursor pagination; offset is deprecated.
      const query=new URLSearchParams({limit:'20'});if(cursor)query.set('cursor',cursor);
      const page=await get(`https://himalayas.app/jobs/api?${query}`);
      pages.push(page);cursor=String(page.nextCursor||'');if(!cursor)break;
    }
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
    const pairs=queryPairs(terms,geo);
    const communeCodes=new Map();const lookupErrors=[];
    // Locate French cities with official public INSEE data; never guess a code.
    for(const zone of geo){try{communeCodes.set(zone.city,await resolveCommune(zone.city,get));}catch(error){lookupErrors.push(error.message);}}
    const requests=pairs.filter(x=>!x.zone||communeCodes.has(x.zone.city)).map(({term,zone})=>async()=>{
      const params=new URLSearchParams({motsCles:term,range:'0-149'});
      if(zone){params.set('commune',communeCodes.get(zone.city));params.set('distance',String(zone.radiusKm));}
      const endpoint=`https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params}`;
      return get(endpoint,{headers:{Authorization:`Bearer ${tk.access_token}`}});
    });
    if(!requests.length)throw new Error(`Aucune commune exploitable : ${lookupErrors[0]||'zones absentes'}`);
    const batch=await settledBatches(requests);
    const out=batch.successes.flatMap(p=>result(p.resultats,'France Travail',j=>({title:j.intitule,company:j.entreprise?.nom||j.entreprise?.description,location:j.lieuTravail?.libelle,description:j.description,url:String(j.origineOffre?.urlOrigine||'').startsWith('https://')?j.origineOffre.urlOrigine:`https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(j.id)}`,publishedAt:j.datePublication||'',applicationEmail:j.contact?.courriel})).map(j=>({...j,source:'France Travail'})));
    out.warnings=[...lookupErrors,...batch.errors];return out;
  }
  if(id==='adzuna'){
    if(!credentials.appId||!credentials.appKey)throw new Error('Identifiants Adzuna non configurés');
    const queries=queryPairs(terms,geo);
    const batch=await settledBatches(queries.map(({term,zone})=>async()=>{
      const q=new URLSearchParams({app_id:credentials.appId,app_key:credentials.appKey,results_per_page:'50',what:term});
      if(zone){q.set('where',zone.city);q.set('distance',String(zone.radiusKm));}
      return get(`https://api.adzuna.com/v1/api/jobs/fr/search/1?${q}`);
    }));
    const out=batch.successes.flatMap(p=>result(p.results,'Adzuna',j=>({title:j.title,company:j.company?.display_name,description:j.description,location:j.location?.display_name,url:j.redirect_url,publishedAt:j.publication_date||''})));
    out.warnings=batch.errors;return out;
  }
  if(id==='jooble'){
    if(!credentials.apiKey)throw new Error('Clé Jooble France non configurée');
    const queries=queryPairs(terms.slice(0,2),geo).slice(0,MAX_QUERIES);
    const batch=await settledBatches(queries.map(({term,zone})=>async()=>{
      return get(`https://fr.jooble.org/api/${encodeURIComponent(credentials.apiKey)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({keywords:term,location:zone?.city||'',page:1})});
    }));
    const out=batch.successes.flatMap(p=>result(p.jobs,'Jooble',j=>({title:j.title,company:j.company,location:j.location,description:j.snippet,url:j.link,updatedAt:j.updated})));
    out.warnings=[...batch.errors,...(geo.length?['Jooble : rayon non garanti par ce connecteur.']:[])];return out;
  }
  if(id==='labonnealternance'){
    // A user may supply their own key, otherwise the desktop uses the operator's
    // read-only relay, configured only after deployment. NEVER bundle a shared key.
    if(!credentials.apiKey && !RELAY_URL)throw new Error('Relais La bonne alternance non déployé et aucune clé personnelle configurée.');
    const criteria=geo.length?geo:[null];
    const romes=LBA_SECTOR_ROMES[sector]||'';
    const requests=criteria.map(zone=>async()=>{
      if(RELAY_URL && !credentials.apiKey){
        const params=new URLSearchParams();
        if(zone){params.set('city',zone.city);params.set('radiusKm',String(zone.radiusKm));}
        if(romes)params.set('romes',romes);
        return get(`${RELAY_URL}/v1/offers?${params}`);
      }
      const params=new URLSearchParams();
      if(romes)params.set('romes',romes);
      if(zone){
        const coords=await get(`https://geo.api.gouv.fr/communes?${new URLSearchParams({nom:zone.city,fields:'nom,code,centre',boost:'population',limit:'8'})}`);
        const match=Array.isArray(coords)&&coords.find(c=>normal(c.nom)===normal(zone.city));
        const point=match?.centre?.coordinates;
        if(!Array.isArray(point)||point.length<2)throw new Error(`Commune non résolue : ${zone.city}`);
        params.set('longitude',String(point[0]));params.set('latitude',String(point[1]));params.set('radius',String(zone.radiusKm));
      }
      return get(`https://api.apprentissage.beta.gouv.fr/api/job/v1/search?${params}`,{headers:{Authorization:`Bearer ${credentials.apiKey}`}});
    });
    const batch=await settledBatches(requests);
    const jobs=batch.successes.flatMap(p=>result(pickJobRecords(p),'La Bonne Alternance',jobToNormalized));
    jobs.warnings=batch.errors;
    if(!geo.length)jobs.warnings.push('Aucune ville : requête nationale, résultats possiblement plafonnés.');
    if(!jobs.length && batch.successes.length)jobs.warnings.push('Réponses API reçues : vérifier le schéma et les annonces avant de conclure à zéro offre.');
    return jobs;
  }
  throw new Error('Source inconnue');
}
function validSourceIds(ids){const valid=new Set(SOURCES.map(x=>x.id));return [...new Set(asArray(ids).filter(x=>typeof x==='string'&&valid.has(x)))];}
function migrateEnabledSources(ids){
  const oldDefault=['arbeitnow','remotive','jobicy','himalayas','remoteok','themuse'];
  const current=validSourceIds(ids);
  // Add the new French default only when the user had not customized the previous defaults.
  const previousFrenchDefault=['alternancestech',...oldDefault];
  if(RELAY_URL && current.length===previousFrenchDefault.length && previousFrenchDefault.every(x=>current.includes(x)))return [...DEFAULT_ENABLED];
  return current.length===oldDefault.length && oldDefault.every(x=>current.includes(x))
    ?[...DEFAULT_ENABLED] : current;
}
async function searchAll({profile={},enabled=DEFAULT_ENABLED,credentials={},searchTypes=['alternance'],zones=[],sector='all',lastRuns={},force=false,fetchImpl=fetch,now=Date.now()}={}) {
  const sources=validSourceIds(enabled);const summaries=[];const jobs=[];
  const safeZones=places(zones);const safeSector=normalizeSector(sector);
  await Promise.all(sources.map(async id=>{
    const elapsed=now-(Date.parse(lastRuns[id])||0);
    const cooldown=(DEFAULT_COOLDOWN_MINUTES[id]||60)*60000;
    if(!force && elapsed>=0 && elapsed<cooldown){summaries.push({id,status:'skipped',count:0,reason:'Prochaine actualisation programmée'});return;}
    try{
      const found=await fetchProvider(id,{profile,credentials:credentials[id]||{},fetchImpl,searchTypes,zones:safeZones,sector:safeSector});
      jobs.push(...found);
      summaries.push({id,status:'ok',count:found.length,at:new Date(now).toISOString(),warnings:(found.warnings||[]).slice(0,4)});
    }catch(err){summaries.push({id,status:'error',count:0,reason:String(err.message).slice(0,120)});}
  }));
  const rank=new Map(sources.map((s,i)=>[s,i]));summaries.sort((a,b)=>rank.get(a.id)-rank.get(b.id));
  return {jobs,sources:summaries};
}
module.exports={RELAY_URL,MAX_QUERIES,queryPairs,resolveCommune,chosenTerms,SOURCES,DEFAULT_ENABLED,DEFAULT_COOLDOWN_MINUTES,normalizeJob,fetchProvider,searchAll,validSourceIds,htmlToText,parseCommunityMarkdown,migrateEnabledSources,searchTerms};
