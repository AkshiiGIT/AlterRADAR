"""Smoke UI for Apple Light, 12 editable zones and Telegram readonly diagnostic (fictitious data only)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
ns={'__file__':str(root/'tests/ui_smoke.py')}
exec((root/'tests/ui_smoke.py').read_text().split('with sync_playwright() as pw:')[0],ns)
html=ns['html'];state=ns['state'];
state['settings'].update({'theme':'dark','searchZones':[{'city':'Paris','radiusKm':30},{'city':'Melun','radiusKm':20}],'sector':'all','appearanceStyle':'tinted','glassTint':'#9b8bff','glassIntensity':50,'reduceEffects':False})
state['sectors']=[{'id':'all','label':'Tous les secteurs'},{'id':'software','label':'Développement logiciel'},{'id':'it','label':'Informatique'}]
mock='window.__mockState='+json.dumps(state,ensure_ascii=False)+'; window.__lastSavedSettings=null; window.__telegramCalls=0; window.radar={state:async()=>structuredClone(window.__mockState),saveSettings:async changes=>{window.__lastSavedSettings=changes;window.__mockState.settings={...window.__mockState.settings,...changes};return structuredClone(window.__mockState);},system:async()=>({totalGb:16,freeGb:8,recommended:"qwen2.5:7b"}),models:async()=>({connected:false,models:[]}),qwenCatalog:async()=>[],wallpaperGet:async()=>"",onModelPull:()=>{},telegramHealth:async()=>{window.__telegramCalls++;return {ready:true,botName:"@RadarDemoBot",message:"Chat privé vérifié",monitoringEnabled:true,approvalsEnabled:true}}};'
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
 page=browser.new_page(viewport={'width':1450,'height':950},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.evaluate(mock);page.add_script_tag(content=(root/'renderer/job-sort.js').read_text());page.add_script_tag(content=(root/'renderer/app.js').read_text());page.wait_for_selector('.app-shell')
 page.locator('[data-nav="settings"]').first.click()
 page.select_option('#theme-selector','apple')
 assert page.evaluate('document.body.dataset.theme')=='light'
 assert page.evaluate('document.body.dataset.appleGlass')=='true'
 page.locator('[data-action="tint-select"][data-color="#77bafc"]').click()
 assert page.evaluate('window.__lastSavedSettings.glassTint')=='#77bafc'
 page.locator('#glass-tint-hex').fill('#e5a8c9')
 page.locator('#glass-tint-hex').press('Tab')
 page.wait_for_function('window.__lastSavedSettings.glassTint === "#e5a8c9"')
 assert page.evaluate('getComputedStyle(document.body).getPropertyValue("--bg").trim()')=='#f5f5f3'
 page.locator('#reduce-effects').check()
 assert page.evaluate('document.body.dataset.reduceEffects')=='true'
 assert page.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--ar-glass-blur").trim()')=='0px'
 page.locator('#reduce-effects').uncheck()
 assert page.evaluate('document.body.dataset.reduceEffects')=='false'
 page.locator('.appearance-settings').scroll_into_view_if_needed()
 page.screenshot(path='/mnt/data/AlterRADAR-v0.13.3-Apercu-Apple-Light.png')
 page.locator('[data-nav="monitor"]').first.click()
 assert page.locator('.geo-zone').count()==2
 page.locator('#geo-radius-0').fill('45')
 assert page.locator('#geo-radius-label-0').inner_text()=='45 km'
 page.locator('[data-action="geo-add"]').click()
 page.locator('#geo-city-2').fill('Évry-Courcouronnes')
 page.locator('#geo-radius-2').fill('35')
 page.locator('#search-sector').select_option('it')
 page.locator('#geo-search-form button[type="submit"]').click()
 page.wait_for_function('window.__lastSavedSettings !== null && window.__lastSavedSettings.searchZones !== undefined')
 zones=page.evaluate('window.__lastSavedSettings.searchZones')
 assert len(zones)==3 and zones[0]['radiusKm']==45 and zones[2]['radiusKm']==35,zones
 page.locator('[data-action="geo-remove"]').nth(1).click()
 assert page.locator('.geo-zone').count()==2
 # Max 12: button disabled after 12 zones.
 for _ in range(10):page.locator('[data-action="geo-add"]').click()
 assert page.locator('.geo-zone').count()==12
 assert page.locator('[data-action="geo-add"]').is_disabled()
 page.screenshot(path='/mnt/data/AlterRADAR-v0.13.3-Apercu-Villes.png',full_page=True)
 page.locator('[data-action="telegram-check"]').click()
 page.wait_for_function('window.__telegramCalls===1')
 assert page.get_by_text('@RadarDemoBot').count()==1
 assert page.get_by_text('Chat privé vérifié').count()==1
 assert not errors,errors
 browser.close()
print('AlterRADAR v0.13.3 : Apple Light, couleurs, effets, 12 zones, Telegram simulé = OK')
