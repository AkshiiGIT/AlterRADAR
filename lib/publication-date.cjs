'use strict';
/** Vérification prudente de la date originale d'une annonce publique.
 *  L'absence de preuve n'est jamais remplacée par une date de découverte.
 *  Les pages sont du contenu non fiable : pas d'exécution JS, pas de cookies, pas d'accès au réseau local.
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
function decodeText(input){return String(input||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&eacute;/gi,'é').replace(/&egrave;/gi,'è').replace(/&ucirc;/gi,'û').replace(/&agrave;/gi,'à');}
function extractPublication(html,{jobTitle=''}={}){
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
  for(const m of text.matchAll(/<time\b([^>]*)>([\s\S]*?)<\/time\s*>/gi)){
    const attrs=tagsAttributes(m[1]);
    const plain=decodeText(m[2].replace(/<[^>]*>/g,' ')).trim();
    if(!/dateposted/i.test(attrs.itemprop||'')&&!/(?:publiée?|posted|publication|published)/i.test(`${attrs.class||''} ${plain}`))continue;
    const date=parsePublishedDate(attrs.datetime)||parsePublishedDate(plain.replace(/^(?:publiée?|posted|published|publication)\s*(?:le|on|:)?\s*/i,''));
    if(date)return {date,evidence:'Balise <time> de publication'};
  }
  // Signaux visibles et EXPLICITES. Une simple date au milieu du texte n'est pas une preuve.
  const body=decodeText(text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
  const pattern=/(?:(?:offre\s+)?publiée?\s+le\s+|postée?\s+le\s+|mise\s+en\s+ligne\s+le\s+|publication\s*:\s*|date\s+de\s+publication\s*:\s*|published\s+(?:on|at)\s*|posted\s+(?:on|at)\s*)([\d]{1,2}[/.\-][\d]{1,2}[/.\-][12]\d{3}|[\d]{1,2}\s+[A-Za-zÀ-ÿ]+\.?\s+[12]\d{3}|[A-Za-z]+\.?\s+\d{1,2},?\s+[12]\d{3}|[12]\d{3}-\d{2}-\d{2})/gi;
  const m=pattern.exec(body);
  if(m){const date=parsePublishedDate(m[1]);if(date)return {date,evidence:'Date de publication visible sur la page'};}
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
/** Protection SSRF: DNS résolu et adresse IPv4 publique fixée dans l'appel HTTPS;
 *  chaque redirection est revérifiée, limite de taille et de durée.
 */
async function retrievePage(input,{maxRedirects=2,timeoutMs=6500,responseType='html'}={}){
  let url=permittedUrl(input);
  for(let redirect=0;redirect<=maxRedirects;redirect++){
    const answers=await dns.lookup(url.hostname,{family:4,all:true});
    if(!answers.length||answers.some(a=>!publicIPv4(a.address)))throw new Error('Hôte non public');
    const pinned=answers[0].address;
    const result=await new Promise((resolve,reject)=>{
      const req=https.get(url,{timeout:timeoutMs,agent:false,lookup:(_hostname,_opts,cb)=>cb(null,pinned,4),headers:{'Accept':responseType==='json'?'application/json':'text/html,application/xhtml+xml','Accept-Encoding':'identity','User-Agent':require('./domain.cjs').USER_AGENT}},res=>{
        const status=res.statusCode||0;
        if([301,302,303,307,308].includes(status)){
          res.resume();resolve({location:res.headers.location,status});return;
        }
        if(status!==200){res.resume();reject(new Error('HTTP '+status));return;}
        const type=String(res.headers['content-type']||'');
        if(type && !(responseType==='json'?/application\/json/i:/html|text\/plain/i).test(type)){res.resume();reject(new Error(responseType==='json'?'Réponse API non JSON':'Document non HTML'));return;}
        const buffers=[];let size=0;
        res.on('data',chunk=>{size+=chunk.length;if(size>(responseType==='json'?2*1024*1024:512*1024)){req.destroy(new Error('Réponse trop volumineuse'));return;}buffers.push(chunk);});
        res.on('end',()=>{
          try{
            let body=Buffer.concat(buffers);
            if(res.headers['content-encoding']==='gzip')body=zlib.gunzipSync(body,{maxOutputLength:1_000_000});
            if(res.headers['content-encoding']==='br')body=zlib.brotliDecompressSync(body,{maxOutputLength:1_000_000});
            resolve({html:body.toString('utf8'),status});
          }catch(error){reject(error);}
        });res.on('error',reject);
      });
      req.on('timeout',()=>req.destroy(new Error('Délai dépassé')));req.on('error',reject);
    });
    if(result.html!==undefined)return result.html;
    if(!result.location||redirect===maxRedirects)throw new Error('Redirection non suivie');
    url=permittedUrl(new URL(result.location,url).href);
  }
  throw new Error('Page indisponible');
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
async function verifyJobDate(job,{fetchPage=retrievePage,aiExtract}={}){
  const checkedAt=new Date().toISOString();
  // If a primary feed explicitly supplied a publication date, the page need not be scraped.
  // This does not apply to dates of detection, last modification or recruitment start.
  const sourcePublished=parsePublishedDate(job.publishedAt);
  if(sourcePublished && /^(?:Date annoncée par API|Date de l[’']API|Ashby Job Postings API|Schema.org JobPosting.datePosted|Métadonnée|Balise <time>|Date de publication visible)/i.test(String(job.publicationEvidence||''))){
    return {publishedAt:sourcePublished,publicationEvidence:job.publicationEvidence,dateCheckedAt:checkedAt,dateCheckStatus:'verified'};
  }
  try{
    permittedUrl(job.url);
    // Prefer the official ATS API when a precise posting URL is available.
    if(ashbyBoardUrl(job.url)){
      try{
        const viaApi=await ashbyPublication(job,{fetchPage});
        if(viaApi)return {publishedAt:viaApi.date,publicationEvidence:viaApi.evidence,dateCheckedAt:checkedAt,dateCheckStatus:'verified'};
      }catch{/* Fall back to the official posting page, and expose any page error. */}
    }
    const html=await fetchPage(job.url);
    let resolved=extractPublication(html,{jobTitle:job.title});
    if(!resolved.date&&typeof aiExtract==='function'){
      const excerpt=candidateExcerpt(html);
      if(excerpt)resolved=checkAiEvidence(await aiExtract(excerpt),excerpt)||resolved;
    }
    return {publishedAt:resolved.date||'',publicationEvidence:resolved.evidence||'',dateCheckedAt:checkedAt,dateCheckStatus:resolved.date?'verified':'unavailable'};
  }catch(err){return {publishedAt:'',publicationEvidence:'',dateCheckedAt:checkedAt,dateCheckStatus:'error',dateCheckError:String(err.message||err).slice(0,100)};}
}
module.exports={titleMatches,parsePublishedDate,extractPublication,verifyJobDate,retrievePage,permittedUrl,publicIPv4,candidateExcerpt,checkAiEvidence,ashbyBoardUrl,matchAshbyPosting,ashbyPublication};
