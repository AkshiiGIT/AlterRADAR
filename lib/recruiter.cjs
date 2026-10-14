'use strict';
function linkedinProfileUrl(value){
  if(!value)return '';
  let url;try{url=new URL(String(value).trim());}catch{throw new Error('URL du contact LinkedIn invalide.');}
  if(url.protocol!=='https:'||!['www.linkedin.com','linkedin.com'].includes(url.hostname.toLowerCase())||!/^\/in\/[a-zA-Z0-9%_-]+\/?/.test(url.pathname)||url.username||url.password||url.port) throw new Error('Utilise un lien de profil LinkedIn https://www.linkedin.com/in/…');
  return url.href;
}
function advertisedRecruiterLinkedin(value){
  // Read links that the employer chose to publish in its own job description.
  // This does not query, crawl or scrape LinkedIn.
  const text=String(value||'');
  const m=/https:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9%_-]+\/?/i.exec(text);
  if(!m)return '';
  try{return linkedinProfileUrl(m[0]);}catch{return '';}
}
function recruiterSummary(job){
  const out=[];
  if(job.recruiterName)out.push(`Contact RH : ${String(job.recruiterName).slice(0,100)}`);
  if(job.recruiterRole)out.push(`Fonction : ${String(job.recruiterRole).slice(0,100)}`);
  if(job.recruiterLinkedin)out.push(`LinkedIn : ${linkedinProfileUrl(job.recruiterLinkedin)}`);
  if(job.applicationEmail)out.push(`E-mail de candidature : ${String(job.applicationEmail).slice(0,180)}`);
  if(!out.length)out.push('Contact RH : non renseigné (aucune donnée inventée).');
  return out.join('\n');
}
module.exports={linkedinProfileUrl,advertisedRecruiterLinkedin,recruiterSummary};
