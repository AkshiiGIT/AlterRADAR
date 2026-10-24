"""Static UI test, fictitious data; requires Playwright/Chromium only in development."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
namespace={'__file__':str(root/'tests/ui_smoke.py')}
exec((root/'tests/ui_smoke.py').read_text().split('with sync_playwright() as pw:')[0],namespace)
html=namespace['html'];data=namespace['state'];mock=namespace['mock']
data['settings']['searchZones']=[{'city':'Paris','radiusKm':30},{'city':'Lille','radiusKm':40}]
data['settings']['sector']='all'
data['sectors']=[{'id':'all','label':'Tous secteurs'},{'id':'software','label':'Développement logiciel'},{'id':'it','label':'Informatique'}]
mock='window.__mockState='+json.dumps(data,ensure_ascii=False)+'; window.__lastSavedSettings=null; window.radar={state:async()=>structuredClone(window.__mockState),saveSettings:async changes=>{window.__lastSavedSettings=changes;window.__mockState.settings={...window.__mockState.settings,...changes};return structuredClone(window.__mockState);},system:async()=>({totalGb:16,freeGb:8,recommended:"qwen2.5:7b"}),models:async()=>({connected:false,models:[]}),qwenCatalog:async()=>[],wallpaperGet:async()=>"",onModelPull:()=>{}};'
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
 page=browser.new_page(viewport={'width':1280,'height':850})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.evaluate(mock)
 page.add_script_tag(content=(root/'renderer/job-sort.js').read_text());page.add_script_tag(content=(root/'renderer/app.js').read_text());page.wait_for_selector('.app-shell')
 page.locator('[data-nav="jobs"]').first.click()
 page.locator('.jobs-page .geo-search-card summary').click()
 assert page.locator('.geo-zone').count()==2
 assert page.locator('#geo-city-0').input_value()=='Paris'
 page.locator('#geo-city-0').fill('Paris')
 page.locator('#geo-radius-0').fill('50')
 page.locator('[data-action="geo-add"]').click()
 page.locator('#geo-city-2').fill('Évry')
 page.locator('#geo-radius-2').fill('30')
 page.locator('#search-sector').select_option('it')
 page.locator('#geo-search-form button[type=submit]').click()
 page.wait_for_function('window.__lastSavedSettings !== null')
 saved=page.evaluate('window.__lastSavedSettings')
 assert saved['searchZones'][0]=={'city':'Paris','radiusKm':50},saved
 assert saved['searchZones'][2]=={'city':'Évry','radiusKm':30} and saved['sector']=='it',saved
 page.locator('[data-nav="monitor"]').first.click()
 assert page.locator('.source-diagnostics').count()==1
 assert page.locator('#geo-search-form').count()==1
 assert not errors,errors
 browser.close()
print('UI v0.13 : formulaires multi-zones, sauvegarde du secteur et diagnostic OK')
