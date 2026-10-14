'use strict';
/**
 * Contrôle PRÉ-PUBLICATION, non exhaustif : Git doit être initialisé.
 * Vérifie uniquement les fichiers INDEXÉS (git add), pas toutes les données
 * locales. Les secrets doivent être protégés même dans l'historique Git.
 */
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function git(args){return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
let files=[];
try {files=git(['diff','--cached','--name-only','--diff-filter=ACMR','-z']).split('\0').filter(Boolean);}
catch {console.error('Initialise git et exécute git add avant npm run check:public.');process.exit(1);}
if(!files.length){console.log('Aucun fichier indexé. Exécute git add avant de vérifier.');process.exit(0);}
const badPaths=/(^|\/)(?:\.env(?:\.[^/]*)?|node_modules|release|dist|secrets\.json|credentials\.json|radar-data\.json|.*\.sqlite3?|.*\.db|.*\.eml|.*\.pem|.*\.key)$/i;
const privateDocs=/(?:^|\/)(?:cv|lettre|motivation|candidature)[-_ ].*\.(?:pdf|docx?|txt)$/i;
const dangerous=[
  ['Jeton Telegram potentiel',/\b\d{8,11}:[A-Za-z0-9_-]{30,}\b/],
  ['Clé privée PEM',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Clé fournisseur IA potentielle',/\bsk-[A-Za-z0-9_-]{28,}\b/]
];
const problems=[];
for(const file of files){
  if(badPaths.test(file)||privateDocs.test(file)){problems.push(`${file}: nom de fichier potentiellement privé`);continue;}
  let content;
  try{content=git(['show',`:${file}`]);}catch{continue;}
  if(content.length>500000)continue;
  for(const [label,regex] of dangerous)if(regex.test(content))problems.push(`${file}: ${label}`);
}
if(problems.length){console.error('Publication interrompue :\n'+problems.join('\n'));process.exit(1);}
console.log(`${files.length} fichier(s) indexé(s) vérifié(s). Aucun motif évident de secret ou document privé détecté.`);
console.log('ATTENTION : ce contrôle ne garantit pas l’absence de données personnelles ; relis git diff --cached.');
