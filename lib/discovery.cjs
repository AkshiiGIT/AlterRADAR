'use strict';
const {jobId,scoreJob,clean,validateHttpsUrl}=require('./domain.cjs');
const {evaluateJob}=require('./rules.cjs');
const {isValidEmail}=require('./workflow.cjs');
const {identifyAts}=require('./ats.cjs');
const {eligibleContract,classifyJob}=require('./contracts.cjs');
const {careerFit}=require('./matching.cjs');
const {sectorFit}=require('./search-preferences.cjs');
const EDUCATION_ORGS=/\b(?:cfa|ecole|école|campus|universite|université|institut de formation|centre de formation|business school|academie|académie|formation professionnelle|school of|enseignement prive|enseignement privé)\b/i;
const KNOWN_SCHOOL_PUBLISHERS=/(?:studi|openclassrooms|iscod|icademie|icadémie|ifocop|mydigitalschool|alternance academy)/i;
function institutionListing(job){
  const publisher=String(job.publisher||'');const employer=String(job.company||'');
  return Boolean(EDUCATION_ORGS.test(publisher)||KNOWN_SCHOOL_PUBLISHERS.test(publisher)||EDUCATION_ORGS.test(employer)||KNOWN_SCHOOL_PUBLISHERS.test(employer));
}
function detectPublicApplicationEmail(job){
  // Job advertisement content alone: never infer emails from a person's name or LinkedIn profile.
  const desc=String(job.description||'').replace(/\s*\[at\]\s*/gi,'@');
  const list=desc.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)||[];
  for(const raw of list){
    const mail=raw.toLowerCase();
    if(!isValidEmail(mail)||/^(?:no-?reply|noreply|support|privacy|rgpd|dpo|webmaster|abuse)@/i.test(mail))continue;
    if(/(?:example\.(?:com|org)|test\.com|localhost)/i.test(mail))continue;
    return mail;
  }
  return '';
}
function mergeDiscovered(existing,offers,{searchTypes=['alternance'],onlyAlternance,excludePrivateSchools=false,profile={},rules=[],excludeUnknownEducation=false,strictCareer=true,strictProfileEducation=true,sector='all',now=new Date().toISOString()}={}){
  // Backward compatible with tests / extensions still passing onlyAlternance.
  if(onlyAlternance===false&&arguments[2]?.searchTypes===undefined)searchTypes=['alternance','stage'];
  const saved=new Map(existing.map(j=>[j.id,j]));
  const accepted=[];const stats={received:offers.length,added:0,duplicates:0,filtered:0,schools:0,careerExcluded:0};
  for(const item of offers){
    if(!item.title||!item.url)continue;
    let url;try{url=validateHttpsUrl(item.url);}catch{continue;}
    if(!eligibleContract(item,searchTypes)){stats.filtered++;continue;}
    if(excludePrivateSchools&&institutionListing(item)){stats.schools++;continue;}
    if(!sectorFit(item,sector).eligible){stats.filtered++;continue;}
    if(!careerFit(item,profile,strictCareer).eligible){stats.filtered++;stats.careerExcluded++;continue;}
    const audit=evaluateJob({...item,score:scoreJob(item,profile)},profile,rules,{excludeUnknownEducation,strictProfileEducation});
    if(!audit.eligible){stats.filtered++;continue;}
    const id=jobId(url); const old=saved.get(id);
    if(old){
      old.lastSeenAt=now;
      if(item.publishedAt && !old.publicationEvidence && !old.publishedAt){old.publishedAt=item.publishedAt;old.publicationEvidence=item.publicationEvidence||'Date de l’API';}
      if(!old.atsId){const detected=identifyAts(url);if(detected.id){old.atsId=detected.id;old.atsName=detected.name;}}
      if(!old.applicationEmail)old.applicationEmail=detectPublicApplicationEmail(item)||'';
      stats.duplicates++;continue;
    }
    const detected=item.atsId?{id:item.atsId,name:item.atsName||identifyAts(url).name}:identifyAts(url);
    const entry={...item,contractTypes:classifyJob(item),id,url,atsId:detected.id||null,atsName:detected.id?detected.name:'Non identifié',description:clean(item.description,12000),applicationEmail:detectPublicApplicationEmail(item)|| (isValidEmail(item.applicationEmail||'')?item.applicationEmail:''),status:'nouvelle',addedAt:now,autoDiscoveredAt:now,lastSeenAt:now};
    saved.set(id,entry);accepted.push(entry);stats.added++;
  }
  return {jobs:[...accepted,...existing],stats};
}
module.exports={institutionListing,detectPublicApplicationEmail,mergeDiscovered};
