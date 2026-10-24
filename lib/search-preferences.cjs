'use strict';
/** User-defined searches. No arbitrary URLs or executable queries are accepted. */
const { FAMILY, titleFamilies } = require('./matching.cjs');
const SECTORS=Object.freeze([{id:'all',label:'Tous les secteurs'}, {id:'it',label:'Informatique · tous métiers'}, ...FAMILY.map(({id,label})=>({id,label}))]);
const VALID_SECTORS=new Set(SECTORS.map(s=>s.id));
const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function normalizeZones(input){
  if(typeof input==='string')input=input.split(/[\n;]+/).filter(Boolean).map(line=>{
    const [city,radius]=line.split('|').map(v=>v.trim());return {city,radiusKm:radius||30};
  });
  if(!Array.isArray(input))throw new Error('Format des zones de recherche invalide.');
  if(input.length>12)throw new Error('Maximum 12 zones géographiques.');
  const found=new Set(),result=[];
  for(const entry of input){
    if(!entry||typeof entry!=='object')throw new Error('Ville invalide.');
    const city=String(entry.city||'').trim().replace(/\s+/g,' ');
    const radiusKm=Number(entry.radiusKm);
    if(city.length<2||city.length>75||/[<>\x00-\x1f]/.test(city))throw new Error('Chaque ville doit comporter entre 2 et 75 caractères.');
    if(!Number.isInteger(radiusKm)||radiusKm<0||radiusKm>100)throw new Error('Le rayon doit être compris entre 0 et 100 km.');
    const key=normal(city);if(found.has(key))continue;found.add(key);
    result.push({city,radiusKm});
  }
  return result;
}
function normalizeSector(input){const s=String(input||'all');if(!VALID_SECTORS.has(s))throw new Error('Secteur d’activité non reconnu.');return s;}
function sectorFit(job={},selected='all'){
  if(selected==='all')return {eligible:true,reason:'Tous secteurs'};
  const detected=titleFamilies(job.title||'');
  if(!detected.length)return {eligible:false,reason:'Secteur indéterminé dans le titre'};
  const itFamilies=new Set(['software','networks','security','cloud','support','data']);
  const good=detected.some(f=>selected==='it'?itFamilies.has(f.id):f.id===selected);
  return {eligible:good,reason:good?'Secteur choisi':'Secteur différent du choix'};
}
function searchFingerprint({profile={},settings={}}={}){
  const crypto=require('node:crypto');
  return crypto.createHash('sha256').update(JSON.stringify({roles:profile.roles||'',location:profile.location||'',zones:settings.searchZones||[],sector:settings.sector||'all',types:settings.searchTypes||[],sources:settings.sourceEnabled||[],excludePrivateSchools:settings.excludePrivateSchools!==false})).digest('hex');
}
module.exports={SECTORS,normalizeZones,normalizeSector,sectorFit,searchFingerprint,normal};
