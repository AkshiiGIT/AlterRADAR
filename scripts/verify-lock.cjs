'use strict';
const fs=require('node:fs');
const path=require('node:path');
const pkg=require('../package.json');
const file=path.join(__dirname,'..','package-lock.json');
if(!fs.existsSync(file)) {
  console.error('package-lock.json manquant : lance npm install --package-lock-only sur ton Mac, puis npm ci. Committe le lockfile avant GitHub Actions.');
  process.exit(1);
}
const lock=JSON.parse(fs.readFileSync(file,'utf8'));
const root=lock.packages?.[''];
if(!root||lock.lockfileVersion<3)throw new Error('Lockfile npm v3 requis.');
for(const type of ['dependencies','devDependencies']){
  for(const [name,version] of Object.entries(pkg[type]||{})){
    if(root[type]?.[name]!==version)throw new Error(`package-lock.json désynchronisé : ${name} attendu ${version}, trouvé ${root[type]?.[name]}`);
    if(!lock.packages[`node_modules/${name}`])throw new Error(`Le module ${name} manque au lockfile.`);
  }
}
console.log('Lockfile cohérent avec AlterRADAR',pkg.version);
