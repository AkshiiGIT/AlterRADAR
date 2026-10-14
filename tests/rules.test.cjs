'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extractRequiredEducation,evaluateJob,defaultRules,validateRule}=require('../lib/rules.cjs');
const check=(description,level=3)=>evaluateJob({title:'Alternance développeur',description,score:91}, {},[{id:'edu',field:'education',value:String(level),enabled:true}]);
test('strict Bac+3 excludes Bac+4 and Bac+5',()=>{
 assert.equal(check('Formation Bac+4 requise').eligible,false);
 assert.equal(check('Tu es en Bac + 5, Master 2').eligible,false);
 assert.equal(check('Formation M1').eligible,false);
 assert.equal(check('Profil Bac+3 recherché').eligible,true);
});
test('ranges and unknown education are processed explicitly',()=>{
 assert.equal(extractRequiredEducation({title:'',description:'Bac+3 à Bac+5'}),3);
 assert.equal(check('Bac+3 à Bac+5 accepté').eligible,true);
 assert.equal(check('Bac+4/5 demandé').eligible,false);
 assert.equal(check('Étudiant motivé').eligible,true);
 const strict=evaluateJob({title:'Stage',description:'Étudiant motivé'}, {}, defaultRules(),{excludeUnknownEducation:true});
 assert.equal(strict.eligible,false);
});
test('custom keywords, location, companies and scoring are hard constraints',()=>{
 const job={title:'Développeur Python en alternance',description:'Python et Linux, 2 jours en télétravail',location:'Paris',company:'Exemple',score:75};
 const rules=[
  validateRule({field:'title_include',value:'Python'}),
  validateRule({field:'location_exclude',value:'Lyon'}),
  validateRule({field:'min_score',value:'70'}),
  validateRule({field:'text_exclude',value:'Java'}),
  validateRule({field:'remote',value:''})
 ];
 assert.equal(evaluateJob(job,{},rules).eligible,true);
 assert.equal(evaluateJob({...job,company:'Exemple'}, {}, [...rules,validateRule({field:'company_exclude',value:'Exemple'})]).eligible,false);
 assert.equal(evaluateJob({...job,score:69},{},rules).eligible,false);
});
test('disabled rules ignored and input validated',()=>{
 assert.equal(evaluateJob({title:'Bac+5'},{},[{...defaultRules()[0],enabled:false}]).eligible,true);
 assert.throws(()=>validateRule({field:'education',value:'9'}));
 assert.throws(()=>validateRule({field:'made-up',value:'y'}));
});
