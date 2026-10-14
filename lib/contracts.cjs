'use strict';
/** Contract selection is independent of the match score. An unclassified job is not silently presented as an internship. */
const KNOWN=Object.freeze(['alternance','stage']);
const canonical=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function normalizeTypes(input){
  if(!Array.isArray(input))return ['alternance'];
  const types=[...new Set(input.filter(t=>KNOWN.includes(t)))];
  if(!types.length)throw new Error('Sélectionne au moins un type de recherche : alternance ou stage.');
  return types;
}
function classifyJob(job={}){
  const text=canonical(`${job.title||''} ${job.description||''} ${job.contractType||''}`);
  const types=[];
  if(/\b(?:alternance|alternant(?:e|s|es)?|apprenti(?:e|s|es)?|apprentissage|contrat\s+de\s+professionnalisation|contrat\s+pro\b|work[ -]?study|dual\s*study)\b/.test(text))types.push('alternance');
  if(/\b(?:stages?|stagiaire(?:s)?|internship(?:s)?|intern(?:s)?|stage\s+de\s+fin\s+d.etudes|pfe)\b/.test(text))types.push('stage');
  return types;
}
function eligibleContract(job,types=['alternance']){
  const selected=normalizeTypes(types);
  return classifyJob(job).some(t=>selected.includes(t));
}
function contractLabel(types){return normalizeTypes(types).map(t=>t==='alternance'?'alternance':'stage').join(' / ');}
module.exports={KNOWN,normalizeTypes,classifyJob,eligibleContract,contractLabel};
