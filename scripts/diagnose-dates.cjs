#!/usr/bin/env node
'use strict';
// Local diagnostic: no CV, keys or other user data transmitted.
const {verifyJobDate,extractPublication}=require('../lib/publication-date.cjs');
const sample='<script type="application/ld+json">{"@type":"JobPosting","title":"Développeur web en alternance","datePosted":"2026-10-12"}</script>';
(async()=>{
 const extracted=extractPublication(sample,{jobTitle:'Développeur web en alternance'});
 console.log('Test du lecteur local :',extracted.date==='2026-10-12'?'OK':'ÉCHEC',extracted.evidence);
 if(extracted.date!=='2026-10-12')process.exitCode=1;
 const url=process.argv[2];
 if(!url){console.log('Pour tester une vraie annonce : npm run diagnose:dates -- https://site.exemple/offre');return;}
 const result=await verifyJobDate({url,title:process.argv.slice(3).join(' ')||''});
 const {dateCheckStatus,publishedAt,publicationEvidence,dateCheckError}=result;
 console.log('Site de l’annonce :',new URL(url).hostname);
 console.log('Résultat :',dateCheckStatus);
 if(publishedAt)console.log('Publication :',publishedAt,'· Source :',publicationEvidence);
 else console.log('Explication :',dateCheckError||'Page reçue, mais date de publication absente ou impossible à prouver.');
 if(dateCheckStatus==='error')process.exitCode=2;
})().catch(err=>{console.error('Erreur de saisie ou de réseau :',String(err.message||err).slice(0,160));process.exitCode=2;});
