'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {careerFit,analyzeMatch,coreFamilies,titleFamilies}=require('../lib/matching.cjs');
const {mergeDiscovered}=require('../lib/discovery.cjs');
const {searchTerms}=require('../lib/sources.cjs');
const {applicationEmail}=require('../lib/email.cjs');
const profile={education:'Bachelor Développement Web et Applications Bac+3',roles:'Développeur web, Développeur full-stack, Développeur back-end',skills:'React, Node.js, JavaScript, TypeScript, PHP, HTML, CSS, SQL, Git',level:'3'};
const job=(title,url='https://example.com/jobs/1',description='Alternance pour Bac+3 avec React et JavaScript')=>({title,url,company:'Entreprise réelle',description});
test('CV développeur => reconnaît des familles métiers sans les saisir séparément',()=>{
  assert.deepEqual(coreFamilies(profile).map(x=>x.id),['software']);
  assert.equal(careerFit(job('Développeur PHP Symfony en alternance'),profile).eligible,true);
  assert.equal(careerFit(job('Développeur mobile Android en stage'),profile).eligible,true);
});
test('n’affiche plus les RH même si des compétences techniques figurent dans le texte',()=>{
  const hr=job('Assistant administratif RH en alternance','https://example.com/rh','Alternance Bac+3 - Python React JavaScript SQL recrutement RH');
  assert.equal(careerFit(hr,profile).eligible,false);
  assert.match(careerFit(hr,profile).reason,/Ressources humaines/);
  assert.ok(analyzeMatch(hr,profile).score<25);
  assert.equal(careerFit(job('Chargé de recrutement IT (alternance)'),profile).eligible,false);
  assert.equal(careerFit(job('Business Developer B2B alternance'),profile).eligible,false);
  // Le nom du département ne doit pas bloquer un vrai poste de développeur.
  assert.equal(careerFit(job('Développeur application RH en alternance'),profile).eligible,true);
});
test('tri strict rejette les postes hors formation avant insertion, mais le mode élargi reste possible',()=>{
  const offers=[job('Assistant RH Alternance','https://example.com/rh'),job('Développeur web React alternance','https://example.com/dev')];
  const strict=mergeDiscovered([],offers,{profile,searchTypes:['alternance'],rules:[],strictCareer:true});
  assert.equal(strict.stats.added,1);
  assert.equal(strict.stats.careerExcluded,1);
  const broad=mergeDiscovered([],offers,{profile,searchTypes:['alternance'],rules:[],strictCareer:false});
  assert.equal(broad.stats.added,2);
});
test('recherche France Travail/Adzuna utilise les métiers du CV, pas juste « alternance »',()=>{
  const terms=searchTerms(profile,['alternance','stage']);
  assert.equal(terms[0],'alternance Développeur web');
  assert.equal(terms.includes('alternance'),false);
  assert.ok(terms.some(t=>t.startsWith('stage Développeur')));
});
test('une candidature stage est libellée stage dans le sujet',()=>{
  const m=applicationEmail(job('Stage Développeur React','https://example.com/stage','Stage développeur React'),{cv:'Voici mon CV complet au format texte',letter:'Voici ma lettre de motivation complète'}, {name:'Camille'});
  assert.match(m.subject,/Candidature stage/);
});
test('titre systèmes réseaux ne déclenche pas la famille design (UX est un mot entier)',()=>{
  assert.ok(!titleFamilies('Administrateur systèmes et réseaux').some(f=>f.id==='design'));
});
