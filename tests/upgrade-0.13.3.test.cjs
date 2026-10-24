'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {checkTelegramHealth}=require('../lib/telegram-health.cjs');
const {normalizeZones}=require('../lib/search-preferences.cjs');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'renderer/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'renderer/style.css'),'utf8');
const main=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
const preload=fs.readFileSync(path.join(root,'electron/preload.cjs'),'utf8');

test('les nouvelles cartes de villes ont un champ, slider, ajout et suppression',()=>{
  assert.match(app,/data-action="geo-add"/);
  assert.match(app,/data-action="geo-remove"/);
  assert.match(fs.readFileSync(path.join(root,'renderer/index.html'),'utf8'),/id="i-trash"/);
  assert.match(app,/class="geo-city"/);
  assert.match(app,/class="geo-radius" type="range"/);
  assert.match(app,/max="100" step="5"/);
  assert.match(app,/form\.querySelectorAll\('\.geo-zone'\)/);
  assert.doesNotMatch(app,/<textarea id="search-zones"/);
});
test('le stockage multi-zones demeure compatible avec le format historique',()=>{
  assert.deepEqual(normalizeZones([{city:'Paris',radiusKm:25},{city:'Melun',radiusKm:35}]),[{city:'Paris',radiusKm:25},{city:'Melun',radiusKm:35}]);
  assert.throws(()=>normalizeZones(Array(13).fill({city:'Évry',radiusKm:20})),/12 zones/);
});
test('Apple Light et teintes sont persistés, et natif macOS reçoit light',()=>{
  assert.match(app,/Apple Light · verre monochrome/);
  assert.match(main,/\['dark','light','system','apple'\]/);
  assert.match(main,/patch\.theme==='apple'\?'light'/);
  assert.match(app,/data-action="tint-select"/);
  assert.match(app,/glass-tint-hex/);
  assert.match(css,/body\[data-apple-glass="true"\]/);
  assert.match(css,/body\[data-reduce-effects="true"\]\[data-wallpaper="image"\]::before/);
});
test('diagnostic Telegram accessible par IPC limité sans fuite du jeton',()=>{
  assert.match(preload,/telegramHealth: \(\) => ipcRenderer\.invoke\('app:telegram-health'\)/);
  assert.match(main,/ipcMain\.handle\('app:telegram-health'/);
  assert.match(app,/data-action="telegram-check"/);
});
test('Telegram absent: avertissement sans requête réseau',async()=>{
  let count=0;
  const value=await checkTelegramHealth({configured:false,request:async()=>{count++;}});
  assert.equal(value.ready,false);assert.equal(count,0);
});
test('Bot valide sans liaison : getMe uniquement, aucun document',async()=>{
  const calls=[];
  const value=await checkTelegramHealth({configured:true,request:async(method)=>{calls.push(method);return {is_bot:true,username:'RadarExampleBot'};}});
  assert.equal(value.ready,false);assert.deepEqual(calls,['getMe']);
  assert.match(value.message,/Termine la liaison/);
});
test('Bot et chat privés vérifiés en lecture seule, sans message ni document',async()=>{
  const calls=[];
  const health=await checkTelegramHealth({configured:true,chatId:'1234567',monitoringEnabled:true,approvalsEnabled:true,request:async(method,data)=>{
    calls.push([method,data]);if(method==='getMe')return {is_bot:true,username:'RadarExampleBot'};
    if(method==='getChat')return {type:'private',id:1234567};
    throw new Error('Un envoi a été tenté !');
  }});
  assert.equal(health.ready,true);assert.equal(health.botName,'@RadarExampleBot');
  assert.equal(health.monitoringEnabled,true);assert.equal(health.approvalsEnabled,true);
  assert.deepEqual(calls.map(x=>x[0]),['getMe','getChat']);
});
test('Chat groupe ou chat inaccessible ne sont pas déclarés prêts',async()=>{
  for(const chat of [{id:-12345,type:'group'},{id:7654321,type:'private'}]){
    const val=await checkTelegramHealth({configured:true,chatId:'1234567',request:async m=>m==='getMe'?{is_bot:true,username:'RadarExampleBot'}:chat});
    assert.equal(val.ready,false);
  }
  const val=await checkTelegramHealth({configured:true,chatId:'1234567',request:async m=>{if(m==='getMe')return {is_bot:true,username:'RadarExampleBot'};throw new Error('Bad Request');}});
  assert.equal(val.ready,false);assert.match(val.message,/inaccessible/);
});
test('getMe inattendu ou compte utilisateur est refusé',async()=>{
  await assert.rejects(()=>checkTelegramHealth({configured:true,request:async()=>({is_bot:false,username:'bad'})}),/bot valide/);
});
