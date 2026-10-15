'use strict';
/** Smoke test executed after `npm ci`: real library APIs, no network, no private data. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createDocxBuffer,createPdfFile} = require('../lib/documents.cjs');
const {extractPdfText} = require('../lib/pdf-text.cjs');

async function run(){
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'alterradar-deps-'));
  const profile = {name:'Camille Martin', email:'camille@example.com',location:'Paris',roles:'Développeuse web'};
  const job = {company:'Entreprise de démonstration',title:'Alternance développeur front-end'};
  const cv = 'Camille Martin\nCompétences\n• TypeScript, React, Node.js\nExpériences\nProjet personnel React\nFormation\nBachelor informatique';
  const letter = 'Madame, Monsieur,\n\nJe candidate au poste proposé. Mon projet en TypeScript et React m’a permis de pratiquer le développement front-end.\n\nJe reste disponible pour échanger.\n\nCordialement.';
  try {
    const cvDocx = await createDocxBuffer(cv,'cv',profile,job);
    assert.ok(Buffer.isBuffer(cvDocx)&&cvDocx.length>1000,'DOCX non généré');
    const raw = await require('mammoth').extractRawText({buffer:cvDocx});
    assert.match(raw.value,/TypeScript/,'DOCX illisible');
    const letterDocx = await createDocxBuffer(letter,'letter',profile,job);
    assert.ok(letterDocx.length>1000,'Lettre DOCX non générée');
    const pdf = path.join(tmp,'CV-demo.pdf');
    await createPdfFile(pdf,cv,'cv',profile,job);
    const bytes = fs.readFileSync(pdf);
    assert.ok(bytes.subarray(0,5).toString()==='%PDF-','PDF invalide');
    const text = await extractPdfText(bytes);
    assert.match(text,/React/,'PDF non lisible via pdf-parse v2');
    const MailComposer = require('nodemailer/lib/mail-composer');
    const content = await new MailComposer({from:'test@example.com',to:'recrutement@example.com',subject:'Candidature',text:'Dossier de démonstration',attachments:[{filename:'CV.docx',content:cvDocx}]}).compile().build();
    assert.ok(Buffer.isBuffer(content)&&content.includes('Content-Disposition'),'MailComposer invalide');
    const nodemailer=require('nodemailer');
    assert.equal(typeof nodemailer.createTransport,'function');
    console.log('OK : DOCX, lecture DOCX, PDF, extraction PDF v2 et brouillon e-mail Nodemailer.');
  } finally {fs.rmSync(tmp,{force:true,recursive:true});}
}
run().catch(e=>{console.error('ÉCHEC smoke dépendances :',e.stack||e);process.exitCode=1;});
