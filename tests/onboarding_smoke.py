"""First-run desktop renderer smoke test, no actual CV data sent to any service."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
state={
 'settings':{'onboardingCompleted':False,'selectedModel':'','theme':'dark','monitoringEnabled':False,'excludePrivateSchools':True,'sourceEnabled':['alternancestech']},
 'documents':{'cv':None,'letter':None},
 'profile':{'name':'','email':'','education':'','level':'','roles':'','skills':'','location':'','rhythm':'','experience':''},
 'outputs':{},'jobs':[],'rules':[], 'sources':[], 'boards':[],'monitoring':{},'statuses':{},'creator':{},'runtime':{}
}
html=(root/'renderer/index.html').read_text()
html=html.replace('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'" />','')
html=html.replace('<link rel="stylesheet" href="style.css" />','<style>'+(root/'renderer/style.css').read_text()+'</style>')
html=html.replace('<script defer src="app.js"></script>','')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
 page=browser.new_page(viewport={'width':1440,'height':960})
 errs=[]
 page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html)
 page.evaluate('''(start)=>{
   window.__state=start; window.__calls={fast:0,scan:0,settings:0};
   window.radar={
    state:async()=>structuredClone(window.__state),system:async()=>({platform:'darwin',totalGb:16,freeGb:9,recommended:'qwen2.5:7b'}),
    models:async()=>({connected:false,models:[]}),
    importDocument:async kind=>{window.__state.documents[kind]={name:kind+'.txt',text:'Alex Martin\\nBachelor Bac+3\\nPython Linux\\nAlternance développeur web',importedAt:'2026-10-14'}; return window.__state.documents[kind];},
    buildProfileFast:async()=>{window.__calls.fast++;window.__state.profile={name:'Alex Martin',email:'',education:'Bachelor Bac+3',level:'3',roles:'développeur web',skills:'Python, Linux',location:'',rhythm:'',experience:''}; return {profile:window.__state.profile,method:'Fast'};},
    saveProfile:async p=>{Object.assign(window.__state.profile,p);window.__state.settings.onboardingCompleted=true;return structuredClone(window.__state);},
    saveSettings:async p=>{window.__calls.settings++;Object.assign(window.__state.settings,p);return structuredClone(window.__state);},
    scanNow:async()=>{window.__calls.scan++;return {imported:0,notified:0,errors:[]};}
   };
  }''',state)
 page.add_script_tag(content=(root/'renderer/job-sort.js').read_text());page.add_script_tag(content=(root/'renderer/app.js').read_text())
 page.locator('[data-action="import-document"][data-kind="cv"]').first.click()
 page.wait_for_function('window.__calls.fast===1')
 page.wait_for_function('document.querySelector(\'[name="level"]\')?.value === "3"')
 page.locator('#profile-form [type="submit"]').click()
 page.wait_for_function('window.__calls.scan===1')
 assert page.locator('text=Offres d’alternance').count()>0
 assert page.evaluate('window.__state.settings.monitoringEnabled') is True
 assert not errs,errs
 browser.close()
print('Onboarding OK: import CV -> extraction rapide -> confirmation -> scan automatique.')
