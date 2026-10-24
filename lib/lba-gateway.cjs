'use strict';
// Public La bonne alternance search ONLY. Never send candidate documents to a relay.
const {normalizeZones}=require('./search-preferences.cjs');
const MINUTES=10;
function validRomes(input){
 const values=String(input||'').toUpperCase().split(',').map(x=>x.trim()).filter(Boolean);
 if(values.length>8 || values.some(x=>!/^[A-N][0-9]{4}$/.test(x)))throw new Error('Codes ROME incorrects (maximum 8).');
 return [...new Set(values)];
}
function validateRelayUrl(url){
 if(!url)return '';
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||!/^\/$|^\/v1\/offers\/?$/.test(parsed.pathname))throw new Error('Adresse du relais non sécurisée.');
 if(['localhost','127.0.0.1','0.0.0.0','[::1]'].includes(parsed.hostname))throw new Error('Un relais public doit utiliser HTTPS et un domaine public.');
 return parsed.origin;
}
// Documented output formats and legacy versions may differ; never fabricate postings.
function pickJobRecords(payload){
 const root=payload?.payload||payload;
 if(Array.isArray(root))return root;
 const found=[];
 const scan=(value,depth)=>{
   if(depth>3||!value||typeof value!=='object')return;
   if(Array.isArray(value)){
     for(const row of value.slice(0,800)){
       if(row&&typeof row==='object'&&(row.offer?.title||row.title||row.intitule))found.push(row);
       else scan(row,depth+1);
     }
     return;
   }
   for(const [key,child] of Object.entries(value)){
     if(['jobs','data','results','matches','offres_emploi_lba','offres_emploi_partenaires','lba','partners'].includes(key))scan(child,depth+1);
   }
 };
 scan(root,0);
 return found.filter(job=>job&&!job.is_spontaneous_application);
}
function jobToNormalized(job){
 const offer=job.offer||{};const workplace=job.workplace||{};
 const link=job.apply?.url||job.application?.url||job.application?.link||job.url||offer.url||job.apply_url||job.applyUrl||job.identifier?.url;
 const location=workplace.location||{};
 return {
  title:offer.title||job.title||job.intitule,
  company:workplace.name||workplace.raison_sociale||job.company?.name||job.company,
  description:offer.description||job.description||'',
  location:typeof job.location==='string'?job.location:(job.location?.address||job.location?.city||job.location?.label||location.address||location.city||location.label||''),
  url:link,
  publishedAt:job.publication?.creation||job.created_at||job.publication_date||job.publishedAt||''
 };
}
function safeQuery({city='',radiusKm=30,romes=''}){
 const zones=city?normalizeZones([{city,radiusKm:Number(radiusKm)}]):[];
 return {zone:zones[0]||null,romes:validRomes(romes)};
}
module.exports={MINUTES,validRomes,validateRelayUrl,pickJobRecords,jobToNormalized,safeQuery};
