'use strict';
const crypto = require('node:crypto');

// Les règles sont déterministes et prioritaires sur tout score / suggestion IA.
const RULE_FIELDS = Object.freeze({
  education: 'Niveau d’études maximum requis',
  location_include: 'Ville / zone à inclure',
  location_exclude: 'Ville / zone à exclure',
  title_include: 'Mot(s) requis dans le titre',
  text_include: 'Mots-clés requis dans l’offre',
  text_exclude: 'Mots-clés interdits',
  company_exclude: 'Entreprises à exclure',
  min_score: 'Score minimal',
  contract: 'Type de contrat : alternance',
  remote: 'Télétravail obligatoire'
});
const canonical = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[\u00a0\u202f]/g,' ').trim();
const tokens = text => String(text || '').split(/[,;\n]/).map(canonical).filter(Boolean).slice(0,40);
function extractRequiredEducation(job) {
  const source = `${job.title || ''}\n${job.description || ''}`;
  const text = canonical(source).replace(/\s+/g,' ');
  const found = [];
  // « bac+3 à bac+5 » permet l’accès dès bac+3, contrairement à « bac+4/5 ».
  const ranges = /\bbac\s*\+\s*([1-8])\s*(?:a|jusqu'?a|(?:-|–|—))\s*(?:bac\s*)?\+?\s*([1-8])\b/g;
  let m;
  const covered = [];
  while ((m = ranges.exec(text))) {
    found.push(Math.min(Number(m[1]),Number(m[2])));
    covered.push([m.index,m.index+m[0].length]);
  }
  const matched = /\bbac\s*\+\s*([1-8])\b/g;
  while ((m=matched.exec(text))) {
    if (!covered.some(([a,b])=>m.index>=a&&m.index<b)) found.push(Number(m[1]));
  }
  // Diplômes / années explicites : « master 1 », « M1 », « master 2 », « M2 ».
  if (/\b(?:master\s*(?:1|i)\b|m1\b)/.test(text)) found.push(4);
  if (/\b(?:master\s*(?:2|ii)\b|m2\b)/.test(text)) found.push(5);
  if (/\b(?:niveau\s+master\b|diplome\s+de\s+master\b|master\s+exige\b)/.test(text) && !/\bmaster\s*(?:1|i)\b/.test(text)) found.push(5);
  // « Ingénieur Bac+5 » est déjà couvert par Bac+5 ; « école d'ingénieur » seul n'est pas concluant.
  return found.length ? Math.min(...found) : null;
}
function defaultRules(){return [{id:'education-default',field:'education',value:'3',enabled:true,mode:'any'}];}
function validateRule(input) {
  if (!input || !Object.hasOwn(RULE_FIELDS,input.field)) throw new Error('Critère de filtre inconnu.');
  const field=input.field;
  const value=String(input.value ?? '').trim().slice(0,350);
  if (field==='education' && (!/^\d$/.test(value) || Number(value)<1 || Number(value)>8)) throw new Error('Niveau Bac+1 à Bac+8 attendu.');
  if (field==='min_score' && (!/^\d{1,3}$/.test(value) || Number(value)>100)) throw new Error('Score entre 0 et 100 attendu.');
  if (!['education','min_score','contract','remote'].includes(field) && !value) throw new Error('Renseigne une valeur de filtre.');
  return {id: /^[a-z\d-]{1,70}$/i.test(input.id || '') ? input.id : crypto.randomUUID(),field,value,
    enabled: input.enabled !== false,mode:input.mode==='all'?'all':'any'};
}
function evaluateJob(job, profile, rules, options={}) {
  const active=Array.isArray(rules)?rules:defaultRules();
  const reasons=[];
  const unknown=[];
  const title=canonical(job.title), body=canonical(`${job.title||''} ${job.description||''}`);
  const location=canonical(job.location), company=canonical(job.company);
  const score=Number(job.score ?? options.score ?? 0);
  for(const r of active){
    if(!r.enabled)continue;
    let failed=false;
    const terms=tokens(r.value);
    const matches=(hay)=>r.mode==='all'?terms.every(w=>hay.includes(w)):terms.some(w=>hay.includes(w));
    switch(r.field){
      case 'education': {
        const needed=extractRequiredEducation(job);
        if(needed===null){unknown.push('Niveau d’études non précisé');failed=!!options.excludeUnknownEducation;}
        else failed=needed>Number(r.value);
        if(failed) reasons.push(needed===null?'Niveau d’études non précisé':`Niveau requis Bac+${needed} supérieur à Bac+${r.value}`);
        break;
      }
      case 'location_include': failed=!matches(location);break;
      case 'location_exclude': failed=matches(location);break;
      case 'title_include': failed=!matches(title);break;
      case 'text_include': failed=!matches(body);break;
      case 'text_exclude': failed=matches(body);break;
      case 'company_exclude': failed=matches(company);break;
      case 'min_score': failed=score<Number(r.value);break;
      case 'contract': failed=!/alternance|apprent|contrat pro\b|work[ -]?study/.test(body);break;
      case 'remote': failed=!/teletravail|full remote|100% remote|distanciel/.test(body);break;
      default: break;
    }
    if(failed && r.field!=='education')reasons.push(RULE_FIELDS[r.field]);
  }
  return {eligible:reasons.length===0,reasons,unknown,requiredEducation:extractRequiredEducation(job)};
}
module.exports={ RULE_FIELDS, defaultRules,validateRule,extractRequiredEducation,evaluateJob };
