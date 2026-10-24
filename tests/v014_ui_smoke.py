"""Optional visual smoke: local fake data only, no network or real personal documents."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
ns={'__file__':str(root/'tests/ui_smoke.py')}
exec((root/'tests/ui_smoke.py').read_text().split('with sync_playwright() as pw:')[0],ns)
state=ns['state'];state['settings'].update({'theme':'light','appearanceStyle':'solid','wallpaperMode':'none','glassTint':'#67407e','glassIntensity':45,'reduceEffects':False,'jobsSort':'score','searchZones':[],'sector':'all','searchTypes':['alternance']})
html=(root/'renderer/index.html').read_text();html=html.replace('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'" />','')
html=html.replace('<link rel="stylesheet" href="style.css" />','<style>'+(root/'renderer/style.css').read_text()+'</style>').replace('<link rel="stylesheet" href="liquid-ui.css" />','<style>'+(root/'renderer/liquid-ui.css').read_text()+'</style>')
html=html.replace('<script defer src="app.js"></script>','').replace('<script defer src="job-sort.js"></script>','')
mock=ns['mock'].replace(json.dumps(ns['state'],ensure_ascii=False),json.dumps(state,ensure_ascii=False))
mock+='\nwindow.radar.qwenCatalog=async()=>[];window.radar.wallpaperGet=async()=>"";window.radar.onModelPull=()=>{};'
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
 page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.evaluate(mock)
 page.add_script_tag(content=(root/'renderer/job-sort.js').read_text());page.add_script_tag(content=(root/'renderer/app.js').read_text())
 page.wait_for_selector('.app-shell',timeout=12000)
 page.screenshot(path=str(root/'preview-v014-pure-white.png'))
 page.locator('[data-nav="settings"]').first.click()
 page.locator('.appearance-settings').scroll_into_view_if_needed()
 assert page.locator('[data-action="theme-preset"]').count()==3
 page.locator('[data-theme-name="dark"]').click()
 assert page.evaluate('document.body.dataset.theme')=='dark'
 page.locator('.appearance-settings').scroll_into_view_if_needed()
 page.screenshot(path=str(root/'preview-v014-twilight.png'))
 page.locator('[data-theme-name="apple"]').click()
 assert page.evaluate('document.body.dataset.appleGlass')=='true'
 page.locator('#reduce-effects').check()
 assert page.evaluate('document.body.dataset.reduceEffects')=='true'
 page.locator('[data-theme-name="light"]').click()
 assert page.evaluate('document.body.dataset.theme')=='light'
 assert page.evaluate('document.body.dataset.reduceEffects')=='true'
 for width,height in [(1680,980),(1440,900),(1280,800),(1024,768),(900,700),(760,680)]:
  page.set_viewport_size({'width':width,'height':height})
  m=page.evaluate('''()=>({root:document.documentElement.scrollWidth, body:document.body.scrollWidth, main:document.querySelector('.main-area').scrollWidth, client:document.querySelector('.main-area').clientWidth})''')
  assert m['root']<=width+1 and m['body']<=width+1 and m['main']<=m['client']+1,(width,m)
 assert not errors,errors
 browser.close()
print('OK v0.14: Pure White, Twilight Purple, glass previews, reduce effects, 6 desktop widths.')
