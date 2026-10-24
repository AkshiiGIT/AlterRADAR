'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {layoutPlan,letterBlocks,cvBlocks}=require('../lib/documents.cjs');
const profile={name:'Camille Dupont',email:'camille@example.org',phone:'0600000000',location:'Paris',roles:'Développeuse full-stack'};
const job={title:'Développeur web en alternance',company:'Entreprise Exemple'};
const cv=`Camille Dupont
Profil
Développeuse web avec des projets personnels en JavaScript et PHP, actuellement en formation en informatique.
Compétences techniques
- JavaScript, TypeScript, HTML, CSS, React, Node.js, PHP, SQL, Git
- Tests, accessibilité, développement web, API REST
Expériences professionnelles
Développeuse stagiaire : conception de pages responsives et correction de bugs frontend.
Projets
- Site de réservation : intégration de formulaires et de contrôles de saisie.
- API REST : création de routes et gestion des erreurs HTTP.
Formation
Bac+3 développement web et applications
Langues
Français, anglais.`;
const letter=`Madame, Monsieur,

Je vous adresse ma candidature au poste de développeur web en alternance au sein de votre entreprise. Mes projets en JavaScript et PHP correspondent aux fonctionnalités décrites dans l'annonce et je souhaite les mettre en pratique dans une équipe de développement.

Dans le cadre de ma formation en informatique, j'ai réalisé un site de réservation, développé des formulaires et travaillé sur une API REST. Ces réalisations m'ont permis d'apprendre à structurer du code, gérer les erreurs et tester les interactions.

Je serais heureuse de contribuer aux évolutions de votre application web, en m'appuyant sur les technologies que je maîtrise et en apprenant celles que votre équipe utilise. Je suis disponible pour échanger sur mes projets et sur les modalités de l'alternance.

Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.`;
test('CV ATS: une colonne, titres structurés, une seule page estimée',()=>{
  const p=layoutPlan(cv,'cv',profile,job);
  assert.ok(p.blocks.some(x=>x.type==='section'&&x.text==='Compétences techniques'));
  assert.ok(p.blocks.some(x=>x.type==='bullet'));
  assert.ok(p.estimatedHeight<850);
  assert.ok(p.preset.font>=9);
});
test('Lettre: en-tête, destinataire, objet, paragraphes et une page estimée',()=>{
  const p=layoutPlan(letter,'letter',profile,job);
  assert.ok(p.blocks.some(x=>x.type==='subject'));
  assert.ok(p.blocks.some(x=>x.type==='recipient'));
  assert.ok(p.blocks.filter(x=>x.type==='letterParagraph').length>=3);
  assert.ok(p.preset.font>=9);
});
test('Document démesuré: ne coupe pas silencieusement et refuse export multipage',()=>{
  assert.throws(()=>layoutPlan('Profil\n'+('Développement frontend, backend, réseau et intégration. '.repeat(700)), 'cv',profile,job),/trop long pour une seule page/i);
  assert.throws(()=>layoutPlan(('Une phrase de motivation très longue. '.repeat(900)), 'letter',profile,job),/trop long pour une seule page/i);
});
test('Une seule page est explicitement garantie dans le plan du CV',()=>{
  assert.equal(layoutPlan(cv,'cv',profile,job).estimatedPages,1);
});
test('Aucun bloc ne prétend ajouter un diplôme ou poste absent',()=>{
  assert.equal(cvBlocks('Profil\nJe maîtrise React.',profile).some(x=>/doctorat|master en informatique/i.test(x.text)),false);
  assert.equal(letterBlocks(letter,profile,job).some(x=>/Entreprise imaginaire/.test(x.text)),false);
});
