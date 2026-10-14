'use strict';
const {isValidEmail,documentsReady}=require('./workflow.cjs');
const {classifyJob}=require('./contracts.cjs');
function safeLine(value,max=200) { return String(value||'').replace(/[\r\n\0\x00-\x1f]/g,' ').trim().slice(0,max); }
function applicationEmail(job, output, profile) {
  if(!job || !documentsReady(output))throw new Error('CV et lettre préparés requis.');
  const title=safeLine(job.title), company=safeLine(job.company), name=safeLine(profile?.name);
  const types=classifyJob(job);
  const kind=types.includes('stage')&&!types.includes('alternance')?'stage':'alternance';
  const to=isValidEmail(job.applicationEmail)?job.applicationEmail.trim():'';
  return {
    to, subject:safeLine(`Candidature ${kind} · ${title}`,200),
    text:`Bonjour,\n\nJe vous adresse ma candidature pour le poste « ${title} » chez ${company}.\n\nVous trouverez mon CV et ma lettre de motivation en pièces jointes.\n\nCordialement,\n${name || 'Le candidat'}`,
    replyTo:isValidEmail(profile?.email)?profile.email.trim():undefined
  };
}
module.exports={safeLine,applicationEmail};
