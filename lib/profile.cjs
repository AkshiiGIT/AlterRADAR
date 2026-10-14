'use strict';
/** Conservative deterministic extraction, for offline use before selecting a local LLM. */
const {clean}=require('./domain.cjs');
const {suggestedJobs,coreFamilies}=require('./matching.cjs');
const SKILLS=['Python','JavaScript','TypeScript','React','Node.js','PHP','HTML','CSS','Java','C++','C#','SQL','PostgreSQL','MySQL','MongoDB','Linux','Windows Server','Active Directory','Cisco','VLAN','OSPF','Docker','Kubernetes','AWS','Azure','Proxmox','VMware','GLPI','Réseau','Cybersécurité','Git','PowerShell','Bash','Figma','Excel'];
const JOBS=['développeur web','développeur fullstack','développeur front-end','développeur back-end','administrateur systèmes et réseaux','technicien informatique','technicien support','analyste cybersécurité','ingénieur réseau','data analyst','devops','développeur logiciel'];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function extractCandidateProfile(cv='',letter=''){
  const text=String(cv||'').slice(0,20000), sample=norm(`${cv}\n${letter}`);
  const email=(text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)||[])[0]||'';
  let name='';
  for(const line of text.split('\n').slice(0,12)){
    const txt=line.trim();
    if(/^[\p{L}\p{M}'’ -]{5,65}$/u.test(txt)&&txt.split(/\s+/).length>=2&&txt.split(/\s+/).length<=4&&!/^(?:curriculum|compétences|experience|expérience|formation|profil|alternance|recherche|contact)/i.test(txt)){name=txt;break;}
  }
  // Only use an explicit education level from the CV, not a guessed degree equivalence from the old letter.
  const education=(text.match(/(?:bac\s*\+\s*[1-8]|bts|but|licence|master\s*[12]?|bachelor|dut)[^\n]{0,100}/i)||[])[0]||'';
  const levelMatch=norm(text).match(/\bbac\s*\+\s*([1-8])\b/);
  const level=levelMatch?levelMatch[1]:'';
  const skills=SKILLS.filter(skill=>sample.includes(norm(skill))).join(', ');
  const explicitRoles=JOBS.filter(role=>sample.includes(norm(role))).slice(0,4).join(', ');
  const city=(text.match(/(?:domicili[ée]\s*(?:à|au)|résidant\s*(?:à|au)|adresse\s*[:：])\s*([^\n,;]{2,60})/i)||[])[1]||'';
  const primary=coreFamilies({roles:explicitRoles,skills,education}).slice(0,3);
  const roles=(primary.length?primary.flatMap(f=>f.suggestions.slice(0,3)).slice(0,9).join(', '):suggestedJobs({roles:explicitRoles,skills,education},6).join(', ')) || explicitRoles;
  return {name:clean(name,120),email:clean(email,150),education:clean(education,180),level,roles:clean(roles,500),skills:clean(skills,500),location:clean(city,180),rhythm:'',experience:''};
}
function validatedProfile(modelOutput,fallback){
  let obj=modelOutput;
  if(typeof obj==='string'){
    const body=obj.match(/\{[\s\S]*\}/)?.[0];
    try{obj=JSON.parse(body||'');}catch{return fallback;}
  }
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return fallback;
  const out={...fallback};
  for(const key of Object.keys(out)){
    const value=obj[key];
    if(typeof value!=='string')continue;
    out[key]=clean(value,key==='experience'?1000:500);
  }
  if(out.level&&!/^[1-8]$/.test(out.level))out.level=fallback.level;
  // Never overwrite the CV email with a hallucinated address.
  if(fallback.email)out.email=fallback.email;
  if(!out.roles.trim()) out.roles=fallback.roles;
  return out;
}
module.exports={extractCandidateProfile,validatedProfile};
