'use strict';
/** Vérification prudente de la date originale d'une annonce publique.
 *  L'absence de preuve n'est jamais remplacée par une date de découverte.
 *  Les pages sont du contenu non fiable.
 *  1. Lecture simple d'abord : pas d'exécution JS, pas de cookies, pas d'accès au réseau local.
 *  2. Seulement si elle échoue ou ne trouve rien, l'application peut fournir `renderPage` : la page
 *     est alors affichée dans une fenêtre cachée isolée (voir decisionRequeteRendu et electron/main.cjs),
 *     et les MÊMES règles de preuve s'appliquent au résultat.
 */
const https=require('node:https');
const dns=require('node:dns').promises;
const net=require('node:net');
const zlib=require('node:zlib');

const MONTHS={janvier:1,fevrier:2,mars:3,avril:4,mai:5,juin:6,juillet:7,aout:8,septembre:9,octobre:10,novembre:11,decembre:12,january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
const accents=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function calendarDate(y,m,d){
  y=Number(y);m=Number(m);d=Number(d);
  if(y<2000||y>2100||m<1||m>12||d<1||d>31)return '';
  const date=new Date(Date.UTC(y,m-1,d));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return '';
  if(date.getTime()>Date.now()+86400000)return '';
  return date.toISOString().slice(0,10);
}
function parsePublishedDate(value){
  if(typeof value==='number'){
    const d=new Date(value<1e11?value*1000:value);
    return Number.isFinite(d.getTime())?calendarDate(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()):'';
  }
  const str=String(value||'').trim();
  if(!str||str.length>100)return '';
  let m=str.match(/^([12]\d{3})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if(m)return calendarDate(m[1],m[2],m[3]);
  m=str.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-]([12]\d{3})(?:\b|$)/);
  if(m)return calendarDate(m[3],m[2],m[1]);
  m=accents(str).match(/^(\d{1,2})\s+([a-z]+)\.?\s+([12]\d{3})\b/);
  if(m&&MONTHS[m[2]])return calendarDate(m[3],MONTHS[m[2]],m[1]);
  m=accents(str).match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+([12]\d{3})\b/);
  if(m&&MONTHS[m[1]])return calendarDate(m[3],MONTHS[m[1]],m[2]);
  return '';
}
function tagsAttributes(tag){
  const attrs={};
  for(const m of String(tag).matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=m[2]??m[3]??m[4];
  return attrs;
}
function titleMatches(original,expected){
  if(!expected)return true;
  if(!original)return false;
  const normalize=t=>accents(String(t)).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  const a=normalize(original),b=normalize(expected);
  if(a===b||a.length>11&&b.length>11&&(a.includes(b)||b.includes(a)))return true;
  const tokens=t=>new Set(t.split(' ').filter(w=>w.length>=4));
  const A=tokens(a),B=tokens(b);
  const common=[...A].filter(x=>B.has(x)).length;
  return common>=2&&common/Math.max(1,Math.min(A.size,B.size))>=0.6;
}
function walkJobPosting(value,depth=0,jobTitle=''){
  if(depth>8||!value||typeof value!=='object')return '';
  if(Array.isArray(value))for(const node of value){const found=walkJobPosting(node,depth+1,jobTitle);if(found)return found;}
  else{
    const type=Array.isArray(value['@type'])?value['@type']:[value['@type']];
    if(type.some(t=>typeof t==='string'&&/(?:^|\/)jobposting$/i.test(t))&&titleMatches(value.title,jobTitle)){
      const candidate=parsePublishedDate(value.datePosted);
      if(candidate)return candidate;
    }
    for(const key of ['@graph','mainEntity','hasPart']){const found=walkJobPosting(value[key],depth+1,jobTitle);if(found)return found;}
  }
  return '';
}
function decodeText(input){return String(input||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;|&#x27;|&rsquo;/gi,"'").replace(/&eacute;/gi,'é').replace(/&egrave;/gi,'è').replace(/&ucirc;/gi,'û').replace(/&agrave;/gi,'à');}
/** Date du jour moins n jours, dans le fuseau de l'utilisateur, au format AAAA-MM-JJ. */
function joursAvant(maintenant,n){
  const d=new Date(maintenant);d.setDate(d.getDate()-n);
  return calendarDate(d.getFullYear(),d.getMonth()+1,d.getDate());
}
/** « Publiée il y a 3 jours », « Publiée hier », « Posted 2 days ago » : seulement en jours ou en heures,
 *  jamais « il y a 2 semaines » ni « 30+ jours », trop imprécis pour une preuve. */
function dateRelative(texte,maintenant){
  const m=/(?:publiée?|publi[ée]e?|mise\s+en\s+ligne|en\s+ligne|posted|published)\s*:?\s*(?:il\s+y\s+a\s+(\d{1,2})\s*(jours?|j|heures?|h|minutes?|min)(?![\w+])|(aujourd['’]hui|hier|today|yesterday)\b|(\d{1,2})\s+(days?|hours?|minutes?)\s+ago\b)/i.exec(texte);
  if(!m)return null;
  let jours=0;
  const unite=accents(m[2]||m[5]||'');
  const nombre=Number(m[1]||m[4]||0);
  if(m[3])jours=/hier|yesterday/i.test(m[3])?1:0;
  else if(/^(jours?|j|days?)$/.test(unite))jours=nombre;
  if(jours>60)return null;
  const date=joursAvant(maintenant,jours);
  return date?{date,evidence:`Date relative affichée (« ${m[0].replace(/\s+/g,' ').trim()} »)`}:null;
}
function texteVisible(html){
  return decodeText(String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
}
/** Le titre de la page (<title> ou premier <h1>) correspond-il à l'offre ? */
function pageDeLOffre(html,jobTitle){
  if(!jobTitle)return true;
  const titre=/<title\b[^>]*>([\s\S]{0,400}?)<\/title\s*>/i.exec(html)?.[1]||'';
  const h1=/<h1\b[^>]*>([\s\S]{0,600}?)<\/h1\s*>/i.exec(html)?.[1]||'';
  return [titre,h1].some(t=>{const propre=decodeText(t.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();return propre&&(titleMatches(propre,jobTitle)||accents(propre).includes(accents(jobTitle).slice(0,40)));});
}
function extractPublication(html,{jobTitle='',maintenant=Date.now()}={}){
  const text=String(html||'').slice(0,1_000_000);
  for(const match of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    const attrs=tagsAttributes(match[1]);
    if(!/^application\/ld\+json\b/i.test(attrs.type||''))continue;
    try{
      const json=JSON.parse(match[2]);const found=walkJobPosting(json,0,jobTitle);
      if(found)return {date:found,evidence:'Schema.org JobPosting.datePosted'};
    }catch{/* Publication script malformed, keep trying. */}
  }
  // Métadonnées de publication explicites uniquement, jamais dateModified / updated_at.
  for(const m of text.matchAll(/<meta\b[^>]*>/gi)){
    const a=tagsAttributes(m[0]);const key=(a.itemprop||a.property||a.name||'').toLowerCase();
    if(!['dateposted','article:published_time','job:published_time','job:dateposted'].includes(key))continue;
    const date=parsePublishedDate(decodeText(a.content||a.datetime));
    if(date)return {date,evidence:'Métadonnée '+key};
  }
  // Microdonnées schema.org sur n'importe quelle balise (<span itemprop="datePosted" content="…">),
  // acceptées seulement si la page n'en porte qu'une valeur : une liste d'offres en aurait plusieurs.
  const microdonnees=new Set();
  for(const m of text.matchAll(/<([a-z][\w-]*)\b([^>]*\bitemprop\s*=\s*["']?datePosted\b[^>]*)>([^<]{0,80})/gi)){
    const a=tagsAttributes(m[2]);
    const date=parsePublishedDate(decodeText(a.content||a.datetime||'').trim())||parsePublishedDate(decodeText(m[3]).trim().replace(/^(?:publiée?|posted|published)\s*(?:le|on|:)?\s*/i,''));
    if(date)microdonnees.add(date);
  }
  if(microdonnees.size===1)return {date:[...microdonnees][0],evidence:'Microdonnée itemprop datePosted'};
  for(const m of text.matchAll(/<time\b([^>]*)>([\s\S]*?)<\/time\s*>/gi)){
    const attrs=tagsAttributes(m[1]);
    const plain=decodeText(m[2].replace(/<[^>]*>/g,' ')).trim();
    if(!/dateposted/i.test(attrs.itemprop||'')&&!/(?:publiée?|posted|publication|published)/i.test(`${attrs.class||''} ${plain}`))continue;
    const date=parsePublishedDate(attrs.datetime)||parsePublishedDate(plain.replace(/^(?:publiée?|posted|published|publication)\s*(?:le|on|:)?\s*/i,''));
    if(date)return {date,evidence:'Balise <time> de publication'};
  }
  // Données embarquées par les sites en JavaScript (ex. __NEXT_DATA__) : un champ « datePosted »
  // hors JSON-LD, avec une seule valeur dans la page ET une page dont le titre est celui de l'offre.
  const scripts=[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(m=>!/application\/ld\+json/i.test(tagsAttributes(m[1]).type||'')).map(m=>m[2]).join('\n');
  const embarquees=new Set([...scripts.matchAll(/\\?["']datePosted\\?["']\s*:\s*\\?["']([^"'\\]{8,40})\\?["']/g)].map(m=>parsePublishedDate(m[1])).filter(Boolean));
  if(embarquees.size===1&&pageDeLOffre(text,jobTitle))return {date:[...embarquees][0],evidence:'Champ datePosted de la page de l’offre'};
  // Signaux visibles et EXPLICITES. Une simple date au milieu du texte n'est pas une preuve.
  const body=texteVisible(text);
  const pattern=/(?:(?:offre\s+)?publiée?\s+le\s*:?\s*|postée?\s+le\s*:?\s*|(?:date\s+de\s+)?mise\s+en\s+ligne\s*(?:le\s*)?:?\s*|en\s+ligne\s+depuis\s+le\s+|publication\s*:\s*|date\s+de\s+publication\s*:?\s*|published\s+(?:on|at)\s*|posted\s+(?:on|at)\s*)([\d]{1,2}[/.\-][\d]{1,2}[/.\-][12]\d{3}|[\d]{1,2}\s+[A-Za-zÀ-ÿ]+\.?\s+[12]\d{3}|[A-Za-z]+\.?\s+\d{1,2},?\s+[12]\d{3}|[12]\d{3}-\d{2}-\d{2})/gi;
  const m=pattern.exec(body);
  if(m){const date=parsePublishedDate(m[1]);if(date)return {date,evidence:'Date de publication visible sur la page'};}
  const relative=dateRelative(body,maintenant);
  if(relative)return relative;
  return {date:'',evidence:''};
}
function publicIPv4(ip){
  if(net.isIP(ip)!==4)return false;
  const [a,b,c,d]=ip.split('.').map(Number);
  if(a===0||a===10||a===127||a>=224||a>=240||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&c===0||b===0&&c===2)||a===198&&b>=18&&b<=19||a===198&&b===51&&c===100||a===203&&b===0&&c===113||a===192&&b===88&&c===99||a===255)return false;
  return true;
}
function permittedUrl(input){
  const url=new URL(String(input||''));
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||net.isIP(url.hostname)||!url.hostname.includes('.')||url.hostname==='localhost'||url.hostname.endsWith('.local')||url.hostname.endsWith('.internal')||url.hostname.endsWith('.localhost'))throw new Error('URL de vérification non autorisée');
  return url;
}
/** Liens de redirection d'agrégateurs : l'adresse finale de l'annonce est déjà dans le lien.
 *  Ex. r.holeest.com/redirect?…&from=https://www.hellowork.com/… (39 % de la liste communautaire). */
const REDIRECTEURS=Object.freeze({'r.holeest.com':['from','url']});
/** Adresse à vérifier : redirecteur connu déballé, paramètres de suivi utm_* retirés. */
function urlDeVerification(input){
  let url;
  try{url=new URL(String(input||''));}catch{return String(input||'');}
  for(const parametre of REDIRECTEURS[url.hostname.toLowerCase()]||[]){
    const cible=url.searchParams.get(parametre);
    if(cible&&/^https:\/\//i.test(cible)){try{url=new URL(cible);break;}catch{/* paramètre illisible */}}
  }
  for(const cle of [...url.searchParams.keys()])if(/^utm_/i.test(cle))url.searchParams.delete(cle);
  return url.href;
}
// Au-delà, la page est tronquée plutôt que rejetée : la date (JSON-LD, en-tête) est presque toujours au début.
const TAILLE_MAX_PAGE=2*1024*1024;
function decompresser(corps,encodage){
  // Les drapeaux « flush » acceptent une réponse tronquée volontairement.
  const options={maxOutputLength:16_000_000};
  if(encodage==='gzip'||encodage==='x-gzip')return zlib.gunzipSync(corps,{...options,finishFlush:zlib.constants.Z_SYNC_FLUSH});
  if(encodage==='deflate')return zlib.inflateSync(corps,{...options,finishFlush:zlib.constants.Z_SYNC_FLUSH});
  if(encodage==='br')return zlib.brotliDecompressSync(corps,{...options,finishFlush:zlib.constants.BROTLI_OPERATION_FLUSH});
  return corps;
}
/** Protection SSRF: DNS résolu et adresse IPv4 publique fixée dans l'appel HTTPS;
 *  chaque redirection est revérifiée, limite de taille et de durée.
 */
async function retrievePage(input,{maxRedirects=5,timeoutMs=10000,responseType='html'}={}){
  let url=permittedUrl(input);
  for(let redirect=0;redirect<=maxRedirects;redirect++){
    const answers=await dns.lookup(url.hostname,{family:4,all:true});
    if(!answers.length||answers.some(a=>!publicIPv4(a.address)))throw new Error('Hôte non public');
    const pinned=answers[0].address;
    const result=await new Promise((resolve,reject)=>{
      const req=https.get(url,{timeout:timeoutMs,agent:false,lookup:(_hostname,_opts,cb)=>cb(null,pinned,4),headers:{
        'Accept':responseType==='json'?'application/json':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Encoding':'gzip, deflate, br',
        'Accept-Language':'fr-FR,fr;q=0.9,en;q=0.6',
        'User-Agent':require('./domain.cjs').USER_AGENT}},res=>{
        const status=res.statusCode||0;
        if([301,302,303,307,308].includes(status)){
          res.resume();resolve({location:res.headers.location,status});return;
        }
        if(status!==200){res.resume();reject(new Error('HTTP '+status));return;}
        const type=String(res.headers['content-type']||'');
        if(type && !(responseType==='json'?/application\/json/i:/html|text\/plain/i).test(type)){res.resume();reject(new Error(responseType==='json'?'Réponse API non JSON':'Document non HTML'));return;}
        const encodage=String(res.headers['content-encoding']||'').toLowerCase().trim();
        const buffers=[];let size=0;let fini=false;
        const terminer=()=>{
          if(fini)return;fini=true;
          try{resolve({html:decompresser(Buffer.concat(buffers),encodage).toString('utf8'),status});}
          catch(error){reject(error.code==='ERR_BUFFER_TOO_LARGE'?new Error('Page trop volumineuse'):error);}
        };
        res.on('data',chunk=>{
          if(fini)return;
          buffers.push(chunk);size+=chunk.length;
          if(size>(responseType==='json'?2*1024*1024:TAILLE_MAX_PAGE)){
            if(responseType==='json'){fini=true;req.destroy();reject(new Error('Réponse trop volumineuse'));return;}
            terminer();req.destroy(); // page lourde : on garde le début
          }
        });
        res.on('end',terminer);res.on('error',error=>{if(!fini){fini=true;reject(error);}});
      });
      req.on('timeout',()=>req.destroy(new Error('Délai dépassé')));req.on('error',reject);
    });
    if(result.html!==undefined)return result.html;
    if(!result.location||redirect===maxRedirects)throw new Error('Trop de redirections');
    url=permittedUrl(new URL(result.location,url).href);
  }
  throw new Error('Page indisponible');
}

// ----- Affichage caché (repli) : règles réseau, appliquées par electron/main.cjs ------------
/** Site approximatif d'un hôte : deux derniers labels, trois pour gouv.fr, co.uk, com.au… */
function siteDe(hote){
  const labels=String(hote||'').toLowerCase().replace(/\.$/,'').split('.');
  if(labels.length<=2)return labels.join('.');
  const n=labels.at(-1).length===2&&['gouv','co','com','org','net','ac','gov','edu','asso','nom'].includes(labels.at(-2))?3:2;
  return labels.slice(-n).join('.');
}
function hoteLocal(hote){
  const h=String(hote||'').toLowerCase().replace(/^\[|\]$/g,'');
  if(!h.includes('.')||h==='localhost'||/\.(?:local|localhost|internal|lan|home|intranet)$/.test(h))return true;
  if(net.isIP(h)===6)return true;
  return net.isIP(h)===4&&!publicIPv4(h);
}
/**
 * Décide si l'affichage caché peut charger une adresse.
 *  - page principale : toute page HTTPS publique (une redirection peut changer de site) ;
 *  - ressources : seulement celles du MÊME site que la page (aucun traceur tiers) ;
 *  - jamais d'image, de vidéo, de police, ni le réseau local, ni autre chose que HTTPS.
 */
function decisionRequeteRendu({url,type,sitePage}){
  let u;try{u=new URL(String(url||''));}catch{return {annuler:true};}
  if(u.protocol==='data:'||u.protocol==='blob:')return {annuler:type==='mainFrame'};
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||hoteLocal(u.hostname))return {annuler:true};
  if(type==='mainFrame')return {annuler:false,site:siteDe(u.hostname)};
  if(['image','media','font','object','ping','cspReport'].includes(type))return {annuler:true};
  return {annuler:!sitePage||siteDe(u.hostname)!==sitePage};
}
function candidateExcerpt(html){
  const body=decodeText(String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
  const matches=[...body.matchAll(/(?:publiée?|publication|posted|published|datePosted)[\s:]{0,25}.{0,90}/gi)].slice(0,5).map(m=>m[0]);
  return matches.join('\n').slice(0,650);
}
/** Le modèle n'est pas une source : il ne peut que citer un extrait réel de la page.
 *  L'extrait cité doit être présent et son texte contenir une date parseable.
 */
function checkAiEvidence(raw,excerpt){
  try{
    const parsed=typeof raw==='string'?JSON.parse(raw):raw;
    const quote=String(parsed?.evidence||'').trim();
    if(quote.length<12||quote.length>160||!excerpt.includes(quote)||!/(?:publiée?|publication|posted|published)/i.test(quote))return null;
    const given=parsePublishedDate(parsed?.date);
    const found=extractPublication(`<p>${quote}</p>`);
    if(!given||found.date!==given)return null;
    return {date:given,evidence:'Extrait visible confirmé (analyse locale)'};
  }catch{return null;}
}
/** Ashby documents publishedAt as the last date the posting was published.
 *  Resolve the precise posting by canonical URL/id, never by title only.
 *  Public GET API only; do not infer posting from an updatedAt field.
 */
function ashbyBoardUrl(input){
  try{
    const u=permittedUrl(input);
    if(u.hostname!=='jobs.ashbyhq.com')return null;
    const parts=u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if(parts.length<2||parts.length>4||!parts.every(part=>/^[a-zA-Z0-9_.-]{2,85}$/.test(part)))return null;
    return {board:parts[0],jobPath:parts.slice(1).join('/'),url:u};
  }catch{return null;}
}
function matchAshbyPosting(job,rows){
  const target=ashbyBoardUrl(job.url);
  if(!target||!Array.isArray(rows))return null;
  const valid=rows.filter(row=>{
    if(!row||typeof row!=='object'||row.isListed===false||!row.jobUrl)return false;
    const u=ashbyBoardUrl(row.jobUrl);
    return u&&u.board===target.board&&u.jobPath===target.jobPath&&titleMatches(row.title,job.title);
  });
  return valid.length===1?valid[0]:null;
}
async function ashbyPublication(job,{fetchPage=retrievePage}={}){
  const target=ashbyBoardUrl(job.url);
  if(!target)return null;
  const apiUrl=`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(target.board)}`;
  const payload=JSON.parse(await fetchPage(apiUrl,{responseType:'json',timeoutMs:6000}));
  const row=matchAshbyPosting(job,payload?.jobs);
  const publishedAt=parsePublishedDate(row?.publishedAt);
  return publishedAt?{date:publishedAt,evidence:'Ashby Job Postings API · publishedAt (dernière publication)'}:null;
}
const motif=err=>String(err?.message||err||'erreur').replace(/\s+/g,' ').slice(0,60);
/**
 * @param {object}   options
 * @param {Function} options.fetchPage   lecture simple (sans JS)
 * @param {Function} options.renderPage  facultatif : affichage isolé de la page, en repli
 * @param {Function} options.aiExtract   facultatif : le modèle local cite un extrait, vérifié ensuite
 */
async function verifyJobDate(job,{fetchPage=retrievePage,aiExtract,renderPage}={}){
  const checkedAt=new Date().toISOString();
  // If a primary feed explicitly supplied a publication date, the page need not be scraped.
  // This does not apply to dates of detection, last modification or recruitment start.
  const sourcePublished=parsePublishedDate(job.publishedAt);
  if(sourcePublished && /^(?:Date annoncée par API|Date de l[’']API|Ashby Job Postings API|Schema.org JobPosting.datePosted|Métadonnée|Microdonnée|Balise <time>|Champ datePosted|Date de publication visible|Date relative affichée)/i.test(String(job.publicationEvidence||''))){
    return {publishedAt:sourcePublished,publicationEvidence:job.publicationEvidence,dateCheckedAt:checkedAt,dateCheckStatus:'verified'};
  }
  const echecTotal=err=>({publishedAt:'',publicationEvidence:'',dateCheckedAt:checkedAt,dateCheckStatus:'error',dateCheckError:String(err?.message||err).slice(0,100)});
  let cible;
  try{cible=permittedUrl(urlDeVerification(job.url)).href;}catch(err){return echecTotal(err);}
  // Prefer the official ATS API when a precise posting URL is available.
  if(ashbyBoardUrl(job.url)){
    try{
      const viaApi=await ashbyPublication(job,{fetchPage});
      if(viaApi)return {publishedAt:viaApi.date,publicationEvidence:viaApi.evidence,dateCheckedAt:checkedAt,dateCheckStatus:'verified'};
    }catch{/* Fall back to the official posting page, and expose any page error. */}
  }
  // 1. Lecture simple.
  let html='',echec=null,resolved={date:'',evidence:''};
  try{html=await fetchPage(cible);resolved=extractPublication(html,{jobTitle:job.title});}
  catch(err){echec=err;}
  // 2. Repli : la page telle qu'un navigateur l'affiche (blocage anti-robot, site en JavaScript…).
  if(!resolved.date&&typeof renderPage==='function'){
    try{
      const rendu=await renderPage(cible);
      const trouve=extractPublication(rendu,{jobTitle:job.title});
      if(trouve.date)resolved={date:trouve.date,evidence:`${trouve.evidence} (page affichée)`};
      if(rendu){html=rendu;echec=null;}
    }catch(err){if(echec)echec=new Error(`${motif(echec)} ; affichage : ${motif(err)}`);}
  }
  // 3. Dernier recours : le modèle local cite un extrait, qui doit exister et contenir la date.
  if(!resolved.date&&html&&typeof aiExtract==='function'){
    const excerpt=candidateExcerpt(html);
    if(excerpt)resolved=checkAiEvidence(await aiExtract(excerpt).catch(()=>''),excerpt)||resolved;
  }
  if(resolved.date)return {publishedAt:resolved.date,publicationEvidence:resolved.evidence,dateCheckedAt:checkedAt,dateCheckStatus:'verified'};
  if(echec)return echecTotal(echec);
  return {publishedAt:'',publicationEvidence:'',dateCheckedAt:checkedAt,dateCheckStatus:'unavailable'};
}
module.exports={titleMatches,parsePublishedDate,extractPublication,verifyJobDate,retrievePage,permittedUrl,publicIPv4,candidateExcerpt,checkAiEvidence,ashbyBoardUrl,matchAshbyPosting,ashbyPublication,urlDeVerification,decisionRequeteRendu,siteDe,dateRelative,REDIRECTEURS};
