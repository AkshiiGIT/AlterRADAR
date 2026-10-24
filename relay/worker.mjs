/**
 * AlterRADAR public read-only gateway for La bonne alternance.
 * Deploy to a Cloudflare Worker and store the API key in a Worker secret.
 * Never publish keys inside Electron, GitHub or this file.
 * This service does not accept or process CV, letters, emails, phone numbers or candidate profiles.
 */
const API='https://api.apprentissage.beta.gouv.fr/api/job/v1/search';
const GEO='https://geo.api.gouv.fr/communes';
const ROME=/^[A-N][0-9]{4}$/;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function paramsFromUrl(url){
 const search=url.searchParams;
 const city=String(search.get('city')||'').trim();
 const radius=Number(search.get('radiusKm')||30);
 const codes=String(search.get('romes')||'').toUpperCase().split(',').map(x=>x.trim()).filter(Boolean);
 if(city.length>75||/[<>\x00-\x1f]/.test(city)|| (city&&city.length<2))throw new Error('Ville invalide.');
 if(!Number.isInteger(radius)||radius<0||radius>100)throw new Error('Rayon invalide (0 à 100 km).');
 if(codes.length>8||codes.some(c=>!ROME.test(c)))throw new Error('Codes ROME invalides.');
 return {city,radiusKm:radius,romes:[...new Set(codes)]};
}
function baseResponse(headers={}){return {'access-control-allow-origin':'*','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'accept','vary':'Origin',...headers};}
async function geoLookup(city,request){
 const u=new URL(GEO);
 u.searchParams.set('nom',city);u.searchParams.set('fields','nom,code,centre');u.searchParams.set('boost','population');u.searchParams.set('limit','8');
 const res=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(7000)});
 if(!res.ok)throw new Error('Référentiel des communes indisponible.');
 const data=await res.json();
 const match=Array.isArray(data)&&data.find(d=>norm(d.nom)===norm(city));
 const coordinates=match?.centre?.coordinates;
 if(!Array.isArray(coordinates)||coordinates.length<2||!coordinates.every(Number.isFinite))throw new Error('Commune introuvable ou coordonnées indisponibles.');
 return {longitude:coordinates[0],latitude:coordinates[1]};
}
export async function handle(request,env,ctx={}){
 const url=new URL(request.url);
 const headers=baseResponse();
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='GET')return json({error:'Méthode non autorisée'},405,headers);
 if(url.pathname==='/health')return json({status:'ok',service:'AlterRADAR La bonne alternance gateway',configured:Boolean(env?.LBA_API_KEY)},200,headers);
 if(url.pathname!=='/v1/offers')return json({error:'Route inconnue'},404,headers);
 if(!env?.LBA_API_KEY)return json({error:'Le relais n’est pas configuré par son administrateur.'},503,headers);
 let p;try{p=paramsFromUrl(url);}catch(error){return json({error:error.message},400,headers);}
 // Cache shared queries. On Cloudflare, cached errors are never stored.
 const key=new Request(new URL(`/v1/offers?${new URLSearchParams({city:p.city,radiusKm:String(p.radiusKm),romes:p.romes.join(',')})}`,url.origin));
 const cache=ctx.cache||(typeof caches!=='undefined'?caches.default:null);
 if(cache){const hit=await cache.match(key);if(hit)return hit;}
 let coordinates;
 try{if(p.city)coordinates=await geoLookup(p.city,request);}
 catch(error){return json({error:error.message},422,headers);}
 const upstream=new URL(API);
 if(coordinates){upstream.searchParams.set('longitude',String(coordinates.longitude));upstream.searchParams.set('latitude',String(coordinates.latitude));upstream.searchParams.set('radius',String(p.radiusKm));}
 if(p.romes.length)upstream.searchParams.set('romes',p.romes.join(','));
 let res;
 try{res=await fetch(upstream,{headers:{accept:'application/json',Authorization:`Bearer ${env.LBA_API_KEY}`},signal:AbortSignal.timeout(16000)});}
 catch{return json({error:'API La bonne alternance momentanément indisponible.'},502,headers);}
 if(!res.ok){
  const err=res.status===429?'Quota atteint, réessaie plus tard.':res.status===401||res.status===403?'Clé du relais invalide ou non autorisée.':`API indisponible (HTTP ${res.status}).`;
  return json({error:err},res.status===429?429:502,headers);
 }
 const text=await res.text();
 if(text.length>4_000_000)return json({error:'Réponse trop volumineuse.'},502,headers);
 let payload;try{payload=JSON.parse(text);}catch{return json({error:'Réponse API invalide.'},502,headers);}
 const output=json({payload,source:'La bonne alternance'},200,baseResponse({'cache-control':'public, max-age=600'}));
 if(cache)ctx.waitUntil?.(cache.put(key,output.clone()));
 return output;
}
export default {fetch:handle};
