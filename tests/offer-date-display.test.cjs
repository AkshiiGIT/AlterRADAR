'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8');
const a=code.indexOf('function jobDateDisplay(job)');
const b=code.indexOf('function jobDateBadge(job)',a);
assert.ok(a>=0&&b>a,'La fonction de date doit être disponible dans le rendu');
const ctx=vm.createContext({Date,Intl});
vm.runInContext(code.slice(a,b),ctx);
const format=job=>vm.runInContext('jobDateDisplay('+JSON.stringify(job)+')',ctx);

test('L’offre avec une date de publication affiche le jour, le mois et l’année',()=>{
 const result=format({publishedAt:'2026-10-10T12:00:00Z',addedAt:'2026-10-15T12:00:00Z'});
 assert.equal(result.kind,'published');
 assert.match(result.text,/Publiée le 10 oct\. 2026/);
});
test('Une offre sans date publiée ne montre pas la date de découverte',()=>{
 const result=format({addedAt:'2026-10-15T12:00:00Z'});
 assert.equal(result.kind,'unknown');
 assert.equal(result.text,'Date à vérifier');
});
test('Une date absente ou non exploitable ne fabrique aucune publication',()=>{
 for(const publishedAt of [undefined,'','pas une date']){
  const result=format({publishedAt});
  assert.equal(result.kind,'unknown');
  assert.equal(result.text,'Date à vérifier');
 }
});
test('La date Greenhouse updated_at n’est jamais présentée comme publication',()=>{
 const result=format({atsId:'greenhouse',publishedAt:'2026-10-10T12:00:00Z'});
 assert.equal(result.kind,'unknown');
 assert.equal(result.text,'Date à vérifier');
});
test('La date apparaît sous une forme lisible dans la liste et le détail',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../renderer/style.css'),'utf8');
 assert.match(code,/<span class="offer-date-line">\$\{jobDateBadge\(job\)\}<\/span>/);
 assert.match(code,/<div class="offer-date-detail"[^>]*>\$\{jobDateBadge\(job\)\}/);
 assert.match(css,/\.offer-date-badge\.published/);
});
