'use strict';
/**
 * Guards the association between an offer and its two drafts. This is a
 * deterministic sanity check, NOT a factual verifier for all LLM assertions.
 * No private data is transmitted, and no inferred dates/durations are added.
 */
const crypto=require('node:crypto');
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ').trim();
function targetSignature(job){
  const fields=['id','url','company','title'].map(key=>normalize(job?.[key]));
  return crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}
const durationNumber=s=>Number(s);
function contractDurations(value){
  const text=normalize(value).replace(/\s+/g,' ');
  const values=new Set();
  const toMonths=(count,unit)=>durationNumber(count)*(unit.startsWith('an')?12:1);
  // Only phrases explicitly tying a duration to THIS contract, internship or alternance.
  const expressions=[
    /\b(?:alternance|stage|contrat(?:\s+(?:d'apprentissage|de professionnalisation|en alternance))?|duree du contrat|duree de l'alternance|duree du stage)\b[^.!?;\n]{0,85}?\b(?:de|d'|pour|pendant|sur|d'une duree de)\s*(\d{1,2})\s*(mois|ans?|annees?)\b/g,
    /\b(?:duree\s*[:=]?|pour une periode de)\s*(\d{1,2})\s*(mois|ans?|annees?)\b/g,
    /\b(\d{1,2})\s*(mois|ans?|annees?)\s+(?:d'|de\s+)(?:alternance|stage|contrat)\b/g
  ];
  for(const pattern of expressions)for(const match of text.matchAll(pattern)){
    const n=toMonths(match[1],match[2]);if(n>=1&&n<=84)values.add(n);
  }
  return [...values].sort((a,b)=>a-b);
}
function exactCompanyMention(text,company){
  const target=normalize(company);
  if(target.length<3)return true;
  const escaped=target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(^|[^\\p{L}\\p{N}])'+escaped+'(?=$|[^\\p{L}\\p{N}])','iu').test(normalize(text));
}
function unexpectedRecipient(text,company){
  const target=normalize(company);
  const candidate=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’]/g,"'");
  // A model may copy the addressee of a letter imported for a different company.
  // Only inspect explicit targeting phrases, not factual references to past employers.
  const expressions=[
    /\b(?:chez|rejoindre|integrer|intégrer)\s+([A-Z][\p{L}\p{N}&.'-]{2,}(?:\s+[A-Z][\p{L}\p{N}&.'-]{2,}){0,2})/giu,
    /\bau sein de\s+(?:la societe\s+|l'entreprise\s+|du groupe\s+|d'|de\s+)?([A-Z][\p{L}\p{N}&.'-]{2,}(?:\s+[A-Z][\p{L}\p{N}&.'-]{2,}){0,2})/giu,
    /\b(?:objet\s*:\s*[^\n]{0,90}?\b(?:chez|pour|aupres de)\s+)([A-Z][\p{L}\p{N}&.'-]{2,})/gu
  ];
  for(const pattern of expressions){
    for(const match of candidate.matchAll(pattern)){
      const guess=normalize(match[1]);
      if(['votre','notre','cette','entreprise','equipe','societe','groupe','vous','une','mon','mes','les','des'].includes(guess))continue;
      // A previous employer referenced as an experience isn't a recipient.
      const prior=normalize(String(text).slice(Math.max(0,match.index-42),match.index));
      if(/(?:travaille|experience|stage effectue|ancien poste|mission effectuee|ai travaille)\s*$/.test(prior))continue;
      if(target && (target.includes(guess)||guess.includes(target)))continue;
      return match[1];
    }
  }
  return '';
}
function targetedContractDurations(text,kind){
  const sentences=normalize(text).split(/[.!?;\n]+/);
  const amounts=new Set();
  for(const sentence of sentences){
    if(!/(alternance|stage|contrat|duree)/.test(sentence))continue;
    const past=/(?:j'ai|j'avais|mon ancien|lors de mon|j'ai realise|j'ai effectue|j'ai travaille|experience de|effectue en|dans le cadre de mon precedent|ancien stage)/.test(sentence);
    const future=/(?:candidature|recherche|souhaite|voudrais|pour ce poste|pour votre offre|offre propose|vous proposez|contrat vise|objectif|rythme recherche)/.test(sentence);
    if(past&&!future)continue;
    if(kind==='cv'&&!future)continue;
    for(const duration of contractDurations(sentence))amounts.add(duration);
  }
  return [...amounts].sort((a,b)=>a-b);
}
function validateDraft(text,kind,job){
  if(!['cv','letter'].includes(kind))throw new Error('Type de candidature inconnu.');
  const issues=[];
  if(!String(text||'').trim())issues.push('Document vide.');
  if(kind==='letter'){
    if(job?.company && !exactCompanyMention(text,job.company))issues.push(`La lettre ne nomme pas l’entreprise cible : ${job.company}.`);
    const wrong=unexpectedRecipient(text,job?.company);
    if(wrong)issues.push(`La lettre semble s’adresser à une autre entreprise (${wrong}).`);
  }
  const offerDurations=contractDurations(job?.description||'');
  // Experience history may legitimately mention an old internship duration.
  // Compare only statements about the contract being sought, not past jobs.
  const draftDurations=targetedContractDurations(text,kind);
  if(draftDurations.length){
    if(!offerDurations.length){
      issues.push('Une durée de contrat est affirmée sans être explicitement vérifiable dans l’offre.');
    }else if(draftDurations.some(n=>!offerDurations.includes(n))){
      issues.push('La durée de contrat annoncée diffère de celle indiquée dans l’offre.');
    }
  }
  return {ok:issues.length===0,issues,signature:targetSignature(job)};
}
function assertApplicationPair(out,job){
  if(!out?.cv?.trim()||!out?.letter?.trim())throw new Error('Dossier incomplet : CV et lettre obligatoires.');
  const signature=targetSignature(job);
  if(out.cvTargetSignature!==signature||out.letterTargetSignature!==signature){
    throw new Error('Ces documents ne sont pas tous liés à la version actuelle de cette offre. Vérifie et enregistre les deux documents pour cette candidature avant validation ou envoi.');
  }
  for(const kind of ['cv','letter']){
    const check=validateDraft(out[kind],kind,job);
    if(!check.ok)throw new Error(`${kind==='cv'?'CV':'Lettre'} incohérent(e) : ${check.issues.join(' ')}`);
  }
  const fromCV=targetedContractDurations(out.cv,'cv'),fromLetter=targetedContractDurations(out.letter,'letter');
  if(fromCV.length&&fromLetter.length&&!fromCV.some(n=>fromLetter.includes(n))){
    throw new Error('Le CV et la lettre indiquent des durées de contrat incompatibles.');
  }
  return true;
}
module.exports={targetSignature,contractDurations,targetedContractDurations,validateDraft,assertApplicationPair,exactCompanyMention,unexpectedRecipient};
