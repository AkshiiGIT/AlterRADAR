const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8');

test('surveillance : checkbox monitoringEnabled existe et reste lisible par le submit',()=>{
  assert.match(app, /name="monitoringEnabled" type="checkbox"/);
  assert.doesNotMatch(app, /name="monitoringEnabled type="/);
  assert.match(app, /form\.elements\.monitoringEnabled\.checked/);
});
test('surveillance : toutes les autres cases utilisées par le formulaire ont leur nom exact',()=>{
  for (const name of ['autoStart','autoPrepare','telegramApprovalsEnabled']) {
    assert.ok(app.includes(`name="${name}" type="checkbox"`), `case ${name} absente ou HTML incorrect`);
    assert.ok(app.includes(`form.elements.${name}.checked`), `gestionnaire ${name} absent`);
  }
});

test('recherche : les deux types ont une case dédiée et sont lus ensemble',()=>{
  assert.match(app,/name=\"searchTypes\" value=\"alternance\"/);
  assert.match(app,/name=\"searchTypes\" value=\"stage\"/);
  assert.match(app,/selectedContracts\(form\)/);
});
