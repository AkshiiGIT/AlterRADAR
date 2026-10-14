const test = require('node:test');
const assert = require('node:assert/strict');
const { recommendedModel, selectInstalledModel, normalizeModels, parseBoard, relevantJob, scoreJob, validateHttpsUrl } = require('../lib/domain.cjs');

test('recommendation depends on total and available RAM', () => {
  assert.equal(recommendedModel(3.7,3.1), null);
  assert.equal(recommendedModel(8,5), 'qwen2.5:3b');
  assert.equal(recommendedModel(16,12), 'qwen2.5:7b');
  assert.equal(recommendedModel(32,17), 'qwen2.5:14b');
  assert.equal(recommendedModel(32,4), 'qwen2.5:3b');
  assert.equal(recommendedModel(8,1.2),null);
});
test('installed models list is unique and sorted', () => {
  const result = normalizeModels({models:[{name:'big:latest',size:8e9},{name:'small:latest',size:1e9,details:{parameter_size:'1B'}},{name:'small:latest',size:1e9}]});
  assert.deepEqual(result.map(x=>x.name),['small:latest','big:latest']);
  assert.equal(result[0].parameters, '1B');
});
test('selected model is kept if installed, falls back otherwise',()=>{
  const mods=[{name:'a'},{name:'b'}];
  assert.equal(selectInstalledModel(mods,'b','a'),'b');
  assert.equal(selectInstalledModel(mods,'removed','b'),'b');
  assert.equal(selectInstalledModel([], 'b','b'),'');
});
test('ATS board parser is restricted to named hosts',()=>{
  assert.deepEqual(parseBoard('https://boards.greenhouse.io/acme/jobs/123'), {source:'Greenhouse',slug:'acme'});
  assert.deepEqual(parseBoard('https://jobs.lever.co/acme'),{source:'Lever',slug:'acme'});
  assert.throws(()=>parseBoard('https://evil.com/boards.greenhouse.io/acme'));
  assert.throws(()=>parseBoard('http://jobs.lever.co/acme'));
});
test('scoring is indicative and detects alternance',()=>{
  const job={title:'Développeur React en alternance',description:'Node.js et React',location:'Paris'};
  assert.equal(relevantJob(job),true);
  assert.ok(scoreJob(job,{roles:'Développeur',skills:'React Node.js',location:'Paris'})>=70);
});
test('user links require HTTPS',()=>{
  assert.throws(()=>validateHttpsUrl('javascript:alert(1)'));
  assert.throws(()=>validateHttpsUrl('http://foo.com'));
  assert.equal(validateHttpsUrl('https://example.com/path'),'https://example.com/path');
});
