"""E2E renderer smoke with fictitious offers; no real external calls or documents."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
ns={'__file__':str(root/'tests/ui_smoke.py')}
exec((root/'tests/ui_smoke.py').read_text().split('with sync_playwright() as pw:')[0],ns)
html=ns['html'];state=ns['state'];state['settings'].update({'theme':'light','jobsSort':'score','searchZones':[{'city':'Paris','radiusKm':35}]})
state['jobs']=[
 {'id':'offer1','title':'Développeur Paris','company':'Entreprise 1','location':'Paris','eligible':True,'score':89,'contractTypes':['alternance'],'source':'Demo','publishedAt':'2026-10-10','addedAt':'2026-10-10'},
 {'id':'offer2','title':'Développeur Lille','company':'Entreprise 2','location':'Lille','eligible':True,'score':56,'contractTypes':['alternance'],'source':'Demo','publishedAt':'2026-10-15','addedAt':'2026-10-15'},
 {'id':'offer3','title':'Développeur Télétravail','company':'Entreprise 3','location':'Télétravail','eligible':True,'score':94,'contractTypes':['alternance'],'source':'Demo','addedAt':'2026-10-09'}]
mock='window.__mockState='+json.dumps(state,ensure_ascii=False)+';window.__saved=[];window.__finishAnalysis=null;window.radar={state:async()=>structuredClone(window.__mockState),saveSettings:async changes=>{window.__saved.push(changes);window.__mockState.settings={...window.__mockState.settings,...changes};return structuredClone(window.__mockState);},system:async()=>({platform:"darwin",totalGb:16,freeGb:8,recommended:"qwen2.5:7b"}),models:async()=>({connected:false,models:[]}),qwenCatalog:async()=>[],wallpaperGet:async()=>"",onModelPull:()=>{},buildProfile:()=>new Promise(resolve=>window.__finishAnalysis=resolve),jobDistances:async()=>({distances:{offer1:0,offer2:205},known:2,checked:3,note:"Distances approximatives entre communes."})};'
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
 page=browser.new_page(viewport={'width':1450,'height':920},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.evaluate(mock)
 page.add_script_tag(content=(root/'renderer/job-sort.js').read_text());page.add_script_tag(content=(root/'renderer/app.js').read_text())
 page.wait_for_selector('.app-shell')
 page.locator('[data-nav="jobs"]').first.click()
 def order():return page.locator('.jobs-page .job-row .job-name').all_inner_texts()
 assert 'Télétravail' in order()[0],order()
 page.locator('#job-sort').select_option('recent');page.wait_for_function('window.__mockState.settings.jobsSort==="recent"')
 assert 'Lille' in order()[0],order()
 page.locator('#job-sort').select_option('distance');page.wait_for_function('window.__mockState.settings.jobsSort==="distance"')
 page.wait_for_function('document.querySelector(".sort-explanation")?.textContent.includes("2/3 offres")')
 assert 'Paris' in order()[0] and 'Télétravail' in order()[-1],order()
 assert page.get_by_text('≈ 205 km').count()==1
 page.locator('.job-toolbar').scroll_into_view_if_needed();page.wait_for_timeout(500);page.screenshot(path='/mnt/data/AlterRADAR-v0.13.4-Apercu-Tri.png')
 page.locator('[data-nav="documents"]').first.click()
 page.locator('[data-action="build-profile"]').first.click()
 page.wait_for_function('window.__finishAnalysis !== null')
 assert page.get_by_text('navigation disponible').count()==1
 page.locator('[data-nav="settings"]').first.click()
 assert page.locator('.appearance-settings').count()==1
 page.evaluate('window.__finishAnalysis({method:"Test simulé"})')
 page.wait_for_function('document.querySelector(".task-progress") === null')
 assert page.locator('.appearance-settings').count()==1, 'Navigation overwritten after async finish'
 assert page.evaluate('document.body.dataset.theme')=='light'
 assert page.evaluate('getComputedStyle(document.body).getPropertyValue("--accent").trim()')=='#242426'
 page.select_option('#theme-selector','dark')
 page.wait_for_function('document.body.dataset.theme === "dark"')
 assert page.evaluate('getComputedStyle(document.body).getPropertyValue("--bg").trim()')=='#08090d'
 page.wait_for_timeout(500);page.screenshot(path='/mnt/data/AlterRADAR-v0.13.4-Apercu-Twilight.png')
 assert not errors,errors
 browser.close()
print('UI 0.13.4: sorting by relevance/recency/distance, navigation during asynchronous analysis, light/dark palette OK.')
