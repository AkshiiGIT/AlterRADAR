'use strict';
/** Scores indicatifs explicables : famille de métiers > compétences attestées > contrat > cursus. */
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/\s+/g,' ').trim();
const FAMILY = Object.freeze([
  {id:'software', label:'Développement logiciel', suggestions:['Développeur web','Développeur front-end','Développeur back-end','Développeur full-stack','Développeur logiciel'], role:/developp|developer|software engineer|programmeur|full.?stack|front.?end|back.?end|integrateur web/, job:/developp|developer|software engineer|programmeur|full.?stack|front.?end|back.?end|integrateur web|ingenieur logiciel/, skills:/javascript|typescript|react|vue\.?js|angular|node\.?js|php|symfony|laravel|html|css|next\.?js|spring boot|java|c\+\+|c#|git\b|django|flask/, education:/developpement|genie logiciel|programmation|web|informatique|computer science/},
  {id:'networks', label:'Systèmes et réseaux', suggestions:['Administrateur systèmes et réseaux','Technicien réseau','Administrateur infrastructure','Technicien systèmes','Ingénieur réseau'], role:/systemes? et reseaux|administrat.*(reseau|systeme)|technicien reseau|network|infrastructure|ingenieur reseau/, job:/systemes? et reseaux|administrat.*(reseau|systeme)|technicien reseau|network|infrastructure|ingenieur reseau|administrateur linux|administrateur windows/, skills:/cisco|vlan|ospf|tcp\/ip|routage|switch|active directory|windows server|vmware|proxmox|hyper.?v|dns\b|dhcp\b|virtualisation|reseau/, education:/reseau|systeme|ciel|infrastructure|informatique/},
  {id:'security', label:'Cybersécurité', suggestions:['Analyste cybersécurité','Analyste SOC','Assistant RSSI','Technicien sécurité informatique','Pentester junior'], role:/cyber|securite informatique|pentest|analyste soc|rssi|securite des systemes/, job:/cyber|securite informatique|pentest|analyste soc|rssi|securite des systemes|security analyst|blue team/, skills:/cybersecurite|pentest|siem|soc\b|splunk|wireshark|opnsense|pfsense|pare.?feu|kali|security|securite/, education:/cyber|securite|reseau|informatique/},
  {id:'cloud', label:'Cloud et DevOps', suggestions:['Technicien DevOps','Administrateur cloud','Assistant ingénieur DevOps','Technicien infrastructure cloud'], role:/devops|cloud|site reliability|sre\b|platform engineer/, job:/devops|cloud|site reliability|sre\b|platform engineer/, skills:/docker|kubernetes|terraform|ansible|aws\b|azure|gcp\b|ci\/cd|jenkins|gitlab ci|helm\b/, education:/cloud|devops|infrastructure|informatique/},
  {id:'support', label:'Support informatique', suggestions:['Technicien support informatique','Technicien helpdesk','Technicien de proximité','Technicien maintenance informatique'], role:/support informatique|helpdesk|technicien informatique|technicien support|maintenance informatique|technicien de proximite/, job:/support informatique|helpdesk|technicien informatique|technicien support|maintenance informatique|technicien de proximite|service desk/, skills:/glpi|ticketing|support|depannage|maintenance|active directory|windows server|outlook|hardware/, education:/ciel|maintenance|support|systeme|informatique/},
  {id:'data', label:'Data et IA', suggestions:['Data analyst','Développeur data','Assistant data engineer','Analyste données'], role:/data analyst|data engineer|machine learning|intelligence artificielle|analyste donnees|big data/, job:/data analyst|data engineer|machine learning|intelligence artificielle|analyste donnees|big data|developpeur ia/, skills:/pandas|numpy|power bi|tableau|sql\b|python|machine learning|tensorflow|pytorch|data science|analyse de donnees/, education:/data|statistique|intelligence artificielle|mathematique|informatique/},
  {id:'design', label:'Design numérique', suggestions:['UX designer','UI designer','Graphiste digital','Webdesigner'], role:/\bux\b|\bui\b|design|graphiste|webdesigner/, job:/\bux\b|\bui\b|design|graphiste|webdesigner/, skills:/figma|photoshop|illustrator|adobe xd|indesign|design system/, education:/design|graphisme|creation numerique/},
  {id:'marketing', label:'Marketing et communication', suggestions:['Assistant marketing','Chargé de communication','Chargé de marketing digital','Community manager'], role:/marketing|communication|community manager|seo\b|sea\b/, job:/marketing|communication|community manager|seo\b|sea\b/, skills:/google analytics|google ads|seo\b|sea\b|campagne marketing|social media|reseaux sociaux/, education:/marketing|communication|publicite/},
  {id:'business', label:'Commerce et relation client', suggestions:['Commercial','Business developer','Chargé de clientèle','Assistant commercial'], role:/commercial|business develop|vente|charge de clientele|relation client/, job:/commercial|business develop|vente|charge de clientele|relation client/, skills:/prospection|crm\b|salesforce|negociation|vente|relation client/, education:/commerce|vente|negociation|business|management commercial/},
  {id:'hr', label:'Ressources humaines', suggestions:['Assistant ressources humaines','Chargé de recrutement','Assistant RH','Gestionnaire RH'], role:/ressources humaines|recrutement|gestionnaire rh|assistant rh|charge rh/, job:/ressources humaines|recrutement|gestionnaire rh|assistant rh|charge rh/, skills:/paie|recrutement|sourcing rh|gestion du personnel|silae/, education:/ressources humaines|gestion rh/},
  {id:'finance', label:'Finance et comptabilité', suggestions:['Assistant comptable','Contrôleur de gestion junior','Assistant financier'], role:/comptab|controle de gestion|finance|audit financier/, job:/comptab|controle de gestion|finance|audit financier/, skills:/sage comptabilite|comptabilite|bilan comptable|excel avance|gestion budgetaire/, education:/comptabilite|finance|gestion comptable/},
  {id:'logistics', label:'Logistique et supply chain', suggestions:['Assistant logistique','Assistant supply chain','Gestionnaire de stocks'], role:/logistique|supply chain|gestionnaire de stock|approvisionnement/, job:/logistique|supply chain|gestionnaire de stock|approvisionnement/, skills:/gestion de stocks|approvisionnement|sap mm|supply chain|transport logistique/, education:/logistique|transport|supply chain/}
]);
function countHits(text, pattern) {
  // Individual skill separators let a broad CV have multiple real signals.
  return String(text || '').split(/[,;\n|]/).map(normalize).filter(Boolean).filter(s=>pattern.test(s)).length;
}
function inferredFamilies(profile={}) {
  const roles=normalize(profile.roles), education=normalize(profile.education);
  const skills=profile.skills || '';
  const ranks=FAMILY.map(f=>{
    const skillHits=countHits(skills,f.skills);
    const roleHit=f.role.test(roles) ? 1 : 0;
    const degreeHit=f.education.test(education) ? 1 : 0;
    return { ...f, signal:skillHits*2 + roleHit*5 + degreeHit*2, skillHits,roleHit,degreeHit };
  }).filter(f=>f.signal>=3).sort((a,b)=>b.signal-a.signal);
  // When training is explicit but the skills list was empty, preserve plausible paths.
  if(!ranks.length && education) return FAMILY.filter(f=>f.education.test(education)).map(f=>({...f,signal:2,skillHits:0,roleHit:0,degreeHit:1})).slice(0,3);
  return ranks.slice(0,6);
}
function suggestedJobs(profile={},max=16) {
  const found=new Set(), suggestions=[];
  for(const f of inferredFamilies(profile))for(const role of f.suggestions){
    if(!found.has(role)){found.add(role);suggestions.push(role);}
    if(suggestions.length>=max)return suggestions;
  }
  return suggestions;
}
/**
 * Métiers issus du CV : on préfère les domaines explicitement recherchés et
 * confirmés par les compétences. La seule mention d'« informatique » dans le
 * cursus ne suffit pas à valider n'importe quel poste (notamment les RH).
 */
function coreFamilies(profile={}) {
  const families=inferredFamilies(profile);
  if(!families.length)return [];
  const best=families[0].signal;
  return families.filter(f=>f.signal>=Math.max(4,Math.ceil(best*0.60))).slice(0,4);
}
function titleFamilies(title='') {
  const text=normalize(title);
  // Titres « business developer » / « développement commercial » ne sont
  // pas des postes de développement logiciel.
  if(/business develop|developpement commercial|charge de developpement commercial/.test(text))
    return FAMILY.filter(f=>f.id==='business');
  // Un poste de chargé de recrutement IT reste un métier RH.
  if(/(?:charge|responsable|assistant|gestionnaire|consultant)[^.]{0,35}(?:recrutement|ressources humaines|\brh\b|paie)/.test(text))
    return FAMILY.filter(f=>f.id==='hr');
  return FAMILY.filter(f=>f.job.test(text));
}
/**
 * Filtre explicable fondé d'abord sur le TITRE du poste ; les mots-clés
 * techniques dans une description RH ne rendent pas l'emploi pertinent.
 * Sans CV analysable, ne pas bloquer artificiellement toute la recherche.
 */
function careerFit(job={},profile={},strict=true) {
  const candidate=coreFamilies(profile);
  if(!strict||!candidate.length)
    return {eligible:true,reason:!candidate.length?'Profil à compléter pour filtrer les métiers':'Recherche élargie activée',confidence:'non déterminée'};
  const groups=titleFamilies(job.title);
  const aligned=groups.filter(g=>candidate.some(c=>c.id===g.id));
  if(aligned.length)
    return {eligible:true,reason:`Métier correspondant au profil : ${aligned.map(g=>g.label).join(', ')}`,confidence:'forte',families:aligned.map(g=>g.id)};
  if(groups.length)
    return {eligible:false,reason:`Métier hors du profil : ${groups.map(g=>g.label).join(', ')}`,confidence:'forte',families:groups.map(g=>g.id)};
  // Un intitulé technique non répertorié doit être revu plutôt que mélangé
  // avec les offres validées. L'utilisateur peut ouvrir la recherche élargie.
  return {eligible:false,reason:'Intitulé non reconnu comme métier compatible (voir Recherche élargie)',confidence:'incertaine',families:[]};
}
function analyzeMatch(job={},profile={}) {
  const title=normalize(job.title), description=normalize(job.description), location=normalize(job.location);
  const candidate=coreFamilies(profile);
  const titleGroups=titleFamilies(title);
  const jobGroups=titleGroups.length?titleGroups:FAMILY.filter(f=>f.job.test(description)).slice(0,2);
  const matches=jobGroups.filter(f=>candidate.some(p=>p.id===f.id));
  const contracts=require('./contracts.cjs').classifyJob(job);
  if(!candidate.length) return {score: contracts.length ? 20 : 0, explanations:['Profil incomplet : importe ton CV pour obtenir un score pertinent.'], matchingFamilies:[]};
  const reasons=[];
  let score=contracts.length?18:0;
  if(contracts.length)reasons.push(`Contrat proposé : ${contracts.join(' / ')}`);
  if(matches.length){score+=46;reasons.push(`Famille de métiers compatible : ${matches.map(f=>f.label).join(', ')}`);}
  else if(jobGroups.length){reasons.push('Métier différent des domaines détectés dans le CV');}
  else {score+=8;reasons.push('Métier non catégorisé : compatibilité incertaine');}
  // Reward requested skills found, but do not divide by every skill in the candidate's CV.
  const keywords=String(profile.skills||'').split(/[,;\n|]/).map(normalize).filter(s=>s.length>=2);
  const text=normalize(`${job.title} ${job.description}`);
  const relevant=keywords.flatMap(k=>{
    if(text.includes(k))return [k];
    // CVs sometimes list technologies separated only by spaces: 'React Node.js'.
    const parts=k.split(/\s+/).filter(x=>x.length>=3);
    return parts.length>1?parts.filter(x=>text.includes(x)):[];
  });
  const skillPoints=Math.min(25,relevant.length*8);
  score+=skillPoints;
  if(relevant.length)reasons.push(`Compétences retrouvées : ${relevant.slice(0,4).join(', ')}`);
  if(matches.length && candidate.some(f=>matches.some(m=>m.id===f.id) && f.degreeHit)){
    score+=7;reasons.push('Formation cohérente avec le domaine');
  }
  const wanted=normalize(profile.location);
  if(wanted && (location.includes(wanted)||wanted.includes(location) && location.length>3)){score+=4;reasons.push('Localisation correspondante');}
  // Un score de 35/100 sur un poste RH ne doit pas suggérer une vraie
  // compatibilité : les mots-clés techniques de sa description n'y changent rien.
  if(jobGroups.length && !matches.length)score=Math.min(score,18);
  return {score: Math.max(0,Math.min(100,Math.round(score))),explanations:reasons,matchingFamilies:matches.map(m=>m.label)};
}
module.exports={FAMILY,inferredFamilies,coreFamilies,titleFamilies,careerFit,suggestedJobs,analyzeMatch,normalize};
