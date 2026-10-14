'use strict';
const crypto = require('node:crypto');

const STATUSES = Object.freeze([
  'nouvelle', 'à examiner', 'cv_en_cours', 'lettre_en_cours',
  'dossier_prêt', 'en_attente_validation', 'à_revoir', 'validée',
  'à_envoyer', 'en_cours_envoi', 'postulée', 'en_attente_reponse',
  'entretien', 'refusée', 'acceptée', 'erreur_envoi'
]);
const LABELS = Object.freeze({
  nouvelle: 'Nouvelle', 'à examiner': 'À examiner', cv_en_cours: 'CV en cours',
  lettre_en_cours: 'Lettre en cours', dossier_prêt: 'Dossier prêt',
  en_attente_validation: 'Validation Telegram', 'à_revoir': 'À revoir',
  validée: 'Validée', 'à_envoyer': 'Envoi manuel requis',
  en_cours_envoi: 'Envoi en cours', postulée: 'Postulée',
  en_attente_reponse: 'En attente de réponse', entretien: 'Entretien',
  refusée: 'Refusée', acceptée: 'Acceptée', erreur_envoi: 'Erreur d’envoi'
});
const HISTORIC_STATUS = Object.freeze({'prête':'dossier_prêt'});
const normalStatus = status => HISTORIC_STATUS[status] || (STATUSES.includes(status) ? status : 'nouvelle');
const documentDigest = output => crypto.createHash('sha256')
  .update(JSON.stringify({cv: String(output?.cv || ''), letter:String(output?.letter || '')}))
  .digest('hex');
function documentsReady(output) {
  return Boolean(typeof output?.cv === 'string' && output.cv.trim().length >= 15 &&
    typeof output?.letter === 'string' && output.letter.trim().length >= 15);
}
function record(job, event, detail = '') {
  if (!job || typeof job !== 'object') throw new Error('Offre absente.');
  if (!Array.isArray(job.history)) job.history = [];
  job.history.unshift({ at: new Date().toISOString(), event: String(event).slice(0,90), detail: String(detail).slice(0,450) });
  job.history = job.history.slice(0,100);
}
const mailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,63}$/i;
function isValidEmail(address) {
  return typeof address === 'string' && address.length < 255 && mailPattern.test(address.trim()) && !/[\r\n]/.test(address);
}
function callbackData(action,id,nonce){
  if(!['approve','reject'].includes(action) || !/^[a-f0-9]{22}$/.test(id)|| !/^[a-f0-9]{20}$/.test(nonce))throw new Error('Validation Telegram invalide.');
  return `${action==='approve'?'a':'r'}:${id}:${nonce}`;
}
function parseCallback(data){
  const result = /^([ar]):([a-f0-9]{22}):([a-f0-9]{20})$/.exec(String(data||''));
  return result ? {action:result[1]==='a'?'approve':'reject',id:result[2],nonce:result[3]} : null;
}
function authorizedCallback(update, chatId){
  const cq=update?.callback_query;
  return Boolean(cq && /^[0-9]{5,20}$/.test(String(chatId)) &&
    String(cq.message?.chat?.id)===String(chatId) &&
    String(cq.from?.id)===String(chatId) &&
    cq.message?.chat?.type==='private');
}
function approvalDecision(job, output, nonce, action){
  if(!job || job.status!=='en_attente_validation')return {ok:false,reason:'Dossier non en attente de validation.'};
  if(!/^[a-f0-9]{20}$/.test(String(nonce)) || job.reviewNonce!==nonce)return {ok:false,reason:'Ce bouton de validation est expiré.'};
  if(!documentsReady(output) || job.reviewDigest!==documentDigest(output))return {ok:false,reason:'Les documents ont changé. Demande une nouvelle validation.'};
  if(!['approve','reject'].includes(action))return {ok:false,reason:'Action inconnue.'};
  return {ok:true,action};
}
module.exports={STATUSES,LABELS,normalStatus,documentDigest,documentsReady,record,isValidEmail,callbackData,parseCallback,authorizedCallback,approvalDecision};
