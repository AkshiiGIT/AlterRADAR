'use strict';
/** Switching candidates must not silently carry one person's information to another. */
const {extractCandidateProfile}=require('./profile.cjs');
const norm=value=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
function candidateChanged(oldProfile,newCvText){
  const next=extractCandidateProfile(newCvText);
  const oldEmail=norm(oldProfile?.email),nextEmail=norm(next.email);
  const oldName=norm(oldProfile?.name),nextName=norm(next.name);
  // Distinct verified emails or identified names => the new CV belongs to another person.
  const emailChanged=Boolean(oldEmail&&nextEmail&&oldEmail!==nextEmail);
  const nameChanged=Boolean(oldName&&nextName&&oldName!==nextName);
  return {changed:emailChanged||nameChanged,detected:next};
}
function resetCandidateData(state){
  state.profile={name:'',email:'',education:'',level:'',roles:'',skills:'',location:'',rhythm:'',experience:''};
  state.documents={cv:null,letter:null};
  state.jobs=[];
  state.outputs={};
  state.rules=require('./rules.cjs').defaultRules().map(r=>({...r,enabled:false}));
  state.monitoring={lastScanAt:'',lastResult:null,sourceRuns:{},sourceResults:[]};
  state.settings.onboardingCompleted=false;
  state.settings.monitoringEnabled=false;
  state.settings.autoPrepare=false;
  state.settings.searchZones=[];
  state.settings.sector='all';
  // Candidate-specific destinations cannot be inherited by another person.
  state.settings.telegramApprovalsEnabled=false;
  state.settings.telegramTokenEncrypted='';
  state.settings.telegramChatId='';
  state.settings.telegramOffset=0;
  state.settings.smtpPasswordEncrypted='';
  state.settings.smtpUser='';
  state.settings.smtpFrom='';
}
function invalidateGeneratedFiles(state){
  state.outputs={};
  for(const job of state.jobs){
    if(['dossier_prêt','en_attente_validation','validée','à_envoyer','erreur_envoi'].includes(job.status))job.status='à_revoir';
    job.reviewNonce='';job.reviewDigest='';job.approvedDigest='';job.approvedMode='';
    job.reviewRecipient='';job.reviewSender='';job.approvedRecipient='';job.approvedSender='';
  }
}
module.exports={candidateChanged,resetCandidateData,invalidateGeneratedFiles};
