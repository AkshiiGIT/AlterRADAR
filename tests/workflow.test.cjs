'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {STATUSES,normalStatus,documentDigest,documentsReady,record,isValidEmail,callbackData,parseCallback,authorizedCallback,approvalDecision}=require('../lib/workflow.cjs');
const { evaluateJob, defaultRules }=require('../lib/rules.cjs');
const id='a'.repeat(22),nonce='b'.repeat(20);
const output={cv:'CV détaillé sur plusieurs lignes.',letter:'Lettre de candidature complète.'};

test('statuts complets et ancien statut migré',()=>{
  for(const name of ['cv_en_cours','lettre_en_cours','en_attente_validation','en_attente_reponse','refusée','acceptée','à_envoyer'])assert.ok(STATUSES.includes(name));
  assert.equal(normalStatus('prête'),'dossier_prêt');
});
test('documents prêts : deux contenus minimum, digest modifie dès une révision',()=>{
  assert.equal(documentsReady(output),true);
  assert.equal(documentsReady({cv:output.cv}),false);
  assert.notEqual(documentDigest(output),documentDigest({...output,cv:output.cv+' modifié'}));
});
test('approbations authentifiées, non réutilisables et liées à la version envoyée',()=>{
  const job={status:'en_attente_validation',reviewNonce:nonce,reviewDigest:documentDigest(output)};
  assert.deepEqual(approvalDecision(job,output,nonce,'approve'),{ok:true,action:'approve'});
  assert.equal(approvalDecision(job,{...output,letter:output.letter+' changée'},nonce,'approve').ok,false);
  assert.equal(approvalDecision(job,output,'c'.repeat(20),'approve').ok,false);
  assert.equal(approvalDecision({...job,status:'acceptée'},output,nonce,'approve').ok,false);
  const data=callbackData('approve',id,nonce);
  assert.deepEqual(parseCallback(data),{action:'approve',id,nonce});
  assert.equal(parseCallback('a:fake:value'),null);
});
test('Telegram valide uniquement les boutons provenant du chat privé configuré',()=>{
  const callback_query={from:{id:123456789},message:{chat:{id:123456789,type:'private'}}};
  assert.equal(authorizedCallback({callback_query},'123456789'),true);
  assert.equal(authorizedCallback({callback_query:{...callback_query,from:{id:999999999}}},'123456789'),false);
  assert.equal(authorizedCallback({callback_query:{...callback_query,message:{chat:{id:123456789,type:'group'}}}},'123456789'),false);
  assert.equal(authorizedCallback({callback_query},'-123456789'),false);
});
test('adresses de candidature vérifiées avant tout envoi',()=>{
  assert.equal(isValidEmail('recrutement@example.fr'),true);
  for(const bad of ['ceci-n-est-pas-un-email','hello@example.fr\nBcc:evil@test.com','a@localhost','','a@b'])assert.equal(isValidEmail(bad),false);
});
test('historique sauvegarde étapes horodatées sans suppression des précédentes',()=>{
  const job={}; record(job,'CV prêt','adapté');record(job,'Validation Telegram','approuvée');
  assert.equal(job.history.length,2);assert.equal(job.history[0].event,'Validation Telegram');
  assert.ok(Number.isFinite(Date.parse(job.history[1].at)));
});
test('règles strictes bloquent les niveaux supérieurs avant la préparation',()=>{
  const r=defaultRules();
  const job={title:'Alternance M2 Développeur',description:'Recherche étudiant Master 2 / Bac+5',location:'Paris',score:99};
  assert.equal(evaluateJob(job,{},r).eligible,false);
});
