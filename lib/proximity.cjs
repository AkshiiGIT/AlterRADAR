'use strict';
/** Approximate distances between commune centres; no CV/identity or recruiter data is transmitted. */
const {normal,normalizeZones}=require('./search-preferences.cjs');
const cache=new Map();
const positiveTTL=24*60*60*1000;
const negativeTTL=10*60*1000;
function cityFromLocation(input){
  const raw=String(input||'').replace(/[\x00-\x1f<>]/g,'').trim();
  if(!raw||raw.length>180||/\b(remote|t[ée]l[ée]travail|anywhere|worldwide|europe|france enti[èe]re|non pr[ée]cis[ée])\b/i.test(raw))return '';
  // Many providers use "75002 Paris, Île-de-France" or "Paris (75)".
  const first=raw.split(/\s*[,;|/]\s*/)[0]
    .replace(/^\s*\d{5}\s+/,'').replace(/\s*\(\s*(?:\d{2}|\d{5})\s*\)\s*$/,'')
    .replace(/\s+\d{5}$/,'').trim();
  if(!first||first.length>75||!/[a-zà-ÿ]/i.test(first))return '';
  return first;
}
function distanceKm(a,b){
  if(!a||!b)return null;
  const [lon1,lat1]=a,[lon2,lat2]=b;
  if(![lon1,lat1,lon2,lat2].every(Number.isFinite))return null;
  const rad=Math.PI/180;
  const phi1=lat1*rad,phi2=lat2*rad;
  const h=Math.sin((phi2-phi1)/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin((lon2-lon1)*rad/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
async function communeCentre(city,fetchImpl=fetch){
  const key=normal(city);
  if(!key)return null;
  const cached=cache.get(key);
  if(cached && cached.until>Date.now())return cached.point;
  const params=new URLSearchParams({nom:city,fields:'nom,centre',boost:'population',limit:'8'});
  let point=null;
  try{
    const res=await fetchImpl(`https://geo.api.gouv.fr/communes?${params}`,{signal:AbortSignal.timeout(6000),headers:{Accept:'application/json'},redirect:'error'});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const json=await res.json();
    if(Array.isArray(json)){
      const exact=json.find(item=>normal(item.nom)===key);
      const coords=exact?.centre?.coordinates;
      if(Array.isArray(coords)&&coords.length===2&&coords.every(x=>Number.isFinite(x)))point=coords;
    }
  }catch{} // A failed geocoder is not a reason to hide or invent a job.
  cache.set(key,{point,until:Date.now()+(point?positiveTTL:negativeTTL)});
  return point;
}
async function approximateDistances(jobs,zones,fetchImpl=fetch){
  const sourceZones=Array.isArray(zones)?zones:[];
  const validZones=normalizeZones(sourceZones);
  if(!validZones.length)return {distances:{},known:0,checked:0,unresolved:0,note:'Ajoute au moins une ville dans les zones de recherche pour calculer la proximité.'};
  // Never geocode more than 80 distinct job cities in one user-requested sort.
  const unique=new Map();
  for(const job of (Array.isArray(jobs)?jobs:[]).slice(0,300)){
    const city=cityFromLocation(job.location);
    if(city && !unique.has(normal(city)) && unique.size<80)unique.set(normal(city),city);
  }
  const names=[...new Set([...validZones.map(z=>z.city),...unique.values()])];
  const resolved=new Map();
  let next=0;
  async function worker(){
    while(next<names.length){const index=next++;const city=names[index];resolved.set(normal(city),await communeCentre(city,fetchImpl));}
  }
  await Promise.all(Array.from({length:Math.min(4,names.length)},()=>worker()));
  const distances={};let known=0;let checked=0;
  for(const job of (Array.isArray(jobs)?jobs:[]).slice(0,300)){
    if(typeof job.id!=='string'||job.id.length>200)continue;
    checked++;
    const city=cityFromLocation(job.location);
    const centre=resolved.get(normal(city));
    let nearest=null;
    for(const zone of validZones){
      const zoneCentre=resolved.get(normal(zone.city));
      // Exact same commune is known to be the closest at 0 km, even if the geocoder is offline.
      const km=normal(zone.city)===normal(city)&&city?0:distanceKm(centre,zoneCentre);
      if(km!==null&& (nearest===null||km<nearest))nearest=km;
    }
    if(nearest!==null){distances[job.id]=Math.round(nearest);known++;}
  }
  return {distances,known,checked,unresolved:checked-known,note:'Distances approximatives entre centres de communes françaises ; les offres sans ville identifiable sont placées en dernier.'};
}
module.exports={cityFromLocation,distanceKm,communeCentre,approximateDistances};
