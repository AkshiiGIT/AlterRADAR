'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createPairingChallenge,pairingCodeFromText,pairingMatches}=require('../lib/pairing.cjs');
const {applicationEmail,safeLine}=require('../lib/email.cjs');
const {linkedinProfileUrl,advertisedRecruiterLinkedin,recruiterSummary}=require('../lib/recruiter.cjs');
const fs=require('node:fs'); const path=require('node:path');
const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
const renderer=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8');

test('code de liaison : 64 bits, 10 min, code brut ou /connect ou /start',()=>{
 const c=createPairingChallenge(1000);
 assert.match(c.code,/^[A-F0-9]{16}$/);
 assert.equal(c.expiresAt,601000);
 for (const v of [c.code,`/connect ${c.code}`,`/start ${c.code}`,`/lier ${c.code}`,`/start@AlterradarBot ${c.code}`]) assert.equal(pairingCodeFromText(v),c.code);
 assert.equal(pairingCodeFromText('un texte aléatoire'),null);
 assert.equal(pairingCodeFromText(`/connect ${c.code} autre`),null);
});
test('liaison exige même utilisateur dans un chat privé, code non expiré',()=>{
 const c=createPairingChallenge(1000);
 const update={message:{chat:{id:123456,type:'private'},from:{id:123456,is_bot:false},text:c.code}};
 assert.equal(pairingMatches(update,c,3000),true);
 assert.equal(pairingMatches(update,c,601000),false);
 assert.equal(pairingMatches({...update,message:{...update.message,chat:{id:2222,type:'group'}}},c,3000),false);
 assert.equal(pairingMatches({...update,message:{...update.message,from:{id:1111,is_bot:false}}},c,3000),false);
 assert.equal(pairingMatches({...update,message:{...update.message,text:'1234567890123456'}},c,3000),false);
});
test('brouillon e-mail : adresse facultative et champs sûrs',()=>{
 const output={cv:'CV de candidature pour alternance.',letter:'Lettre de motivation professionnelle.'};
 const job={title:'Développeur\r\nBcc: pirate@example.org',company:'Entreprise',applicationEmail:''};
 const mail=applicationEmail(job,output,{name:'Candidat',email:'candidat@example.org'});
 assert.equal(mail.to,'');assert.match(mail.subject,/Candidature alternance/);
 assert.doesNotMatch(mail.subject,/\r|\n/); assert.ok(mail.text.includes('en pièces jointes'));
 assert.equal(safeLine('bonjour\r\nmalveillant'),'bonjour  malveillant');
 assert.throws(()=>applicationEmail(job,{cv:'vide'},{}),/CV et lettre/);
});
test('données recruteur : LinkedIn uniquement si connu, jamais inventé',()=>{
 assert.equal(linkedinProfileUrl(''),'');
 assert.match(linkedinProfileUrl('https://www.linkedin.com/in/example-candidat/'),/linkedin.com\/in\//);
 for(const url of ['https://evil.com/in/person','http://www.linkedin.com/in/person','https://www.linkedin.com/company/x'])assert.throws(()=>linkedinProfileUrl(url));
 assert.equal(advertisedRecruiterLinkedin('Voir https://www.linkedin.com/in/recrutement-exemple et postuler'), 'https://www.linkedin.com/in/recrutement-exemple');
 assert.equal(advertisedRecruiterLinkedin('Pas de contact RH public.'),'');
 assert.match(recruiterSummary({company:'Anonyme'}),/non renseigné/);
 assert.match(recruiterSummary({recruiterName:'Mme RH'}),/Mme RH/);
});
test('mode brouillon après validation, version de document liée à Telegram, aucun envoi non confirmé',()=>{
 assert.match(main,/approvedDigest!==documentDigest/);
 assert.match(main,/approvedRecipient!==/);
 assert.match(main,/approvedMode!=='auto'/);
 assert.match(main,/deliveryMode==='draft'/);
 assert.match(main,/MailComposer/);
 assert.match(main,/Brouillon .eml/);
 assert.match(renderer,/Ouvrir .eml/);
 assert.match(renderer,/Exporter .eml/);
 assert.match(renderer,/linkedinUrl/);
});
