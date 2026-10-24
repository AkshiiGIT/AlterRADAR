"""UI smoke with local fake data only, no Telegram or private files."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
ns={'__file__':str(root/'tests/ui_smoke.py')}
exec((root/'tests/ui_smoke.py').read_text().split('with sync_playwright() as pw:')[0],ns)
html=ns['html'];state=ns['state']; mock=ns['mock']
# Six fake models; no external model download occurs.
catalog=[{'name':'qwen2.5:1.5b','label':'Qwen 2.5 · 1.5B','minRam':4,'note':'Compact'},
{'name':'qwen2.5:3b','label':'Qwen 2.5 · 3B','minRam':8,'note':'Équilibré'},
{'name':'qwen2.5:7b','label':'Qwen 2.5 · 7B','minRam':16,'note':'Polyvalent'},
{'name':'qwen2.5:14b','label':'Qwen 2.5 · 14B','minRam':32,'note':'Exigeant'},
{'name':'qwen2.5-coder:3b','label':'Coder 3B','minRam':8,'note':'Code'},
{'name':'qwen2.5-coder:7b','label':'Coder 7B','minRam':16,'note':'Code'}]
mock+='\nwindow.radar.qwenCatalog=async()=>'+json.dumps(catalog,ensure_ascii=False)+';'
mock+="\nwindow.radar.wallpaperGet=async()=>''; window.radar.installModel=async(n)=>({name:n}); window.radar.wallpaperImport=async()=>{window.__mockState.settings.wallpaperMode='image'; return {dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/f6RQAAAAASUVORK5CYII='}}; window.radar.wallpaperClear=async()=>{window.__mockState.settings.wallpaperMode='none'; return true};"
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
 page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.evaluate(mock);page.evaluate('window.radar.onModelPull=()=>{}');page.add_script_tag(content=(root/'renderer/job-sort.js').read_text());page.add_script_tag(content=(root/'renderer/app.js').read_text());page.wait_for_selector('.app-shell',timeout=10000)
 page.evaluate("ui.state.jobs=Array.from({length:34},(_,i)=>({id:String(i),title:'Alternance Développeur Web',company:'Exemple',location:'Paris',eligible:i<6,score:80,contractTypes:['alternance'],status:'nouvelle'}));ui.page='jobs';render()")
 assert page.locator('.nav-count').inner_text()=='6',page.locator('.nav-count').inner_text()
 assert '34 analysées' in page.locator('.jobs-page .card-header').first.inner_text()
 page.locator('[data-nav="settings"]').first.click()
 assert page.locator('.model-market-item').count()==6
 page.select_option('#appearance-style','tinted')
 page.select_option('#wallpaper-mode','gradient')
 assert page.evaluate('document.body.dataset.appearance')=='tinted'
 assert page.evaluate('document.body.dataset.wallpaper')=='gradient'
 for width,height in [(1680,920),(1440,900),(1280,800),(1024,768),(900,700),(760,680)]:
  page.set_viewport_size({'width':width,'height':height})
  metrics=page.evaluate('''()=>({root:document.documentElement.scrollWidth,body:document.body.scrollWidth,main:document.querySelector('.main-area').scrollWidth,mainClient:document.querySelector('.main-area').clientWidth,offscreen:[...document.querySelectorAll('main button')].filter(e=>{let r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).length})''')
  assert metrics['root']<=width+1 and metrics['body']<=width+1 and metrics['main']<=metrics['mainClient']+1 and not metrics['offscreen'],(width,metrics)
 page.set_viewport_size({'width':1440,'height':900})
 page.locator('.appearance-settings').scroll_into_view_if_needed()
 page.screenshot(path=str(root/'preview-apparence-v0.12.0.png'))
 page.locator('[data-action="wallpaper-pick"]').click()
 assert page.evaluate('document.body.dataset.wallpaper')=='image'
 page.locator('[data-action="wallpaper-clear"]').click()
 assert page.evaluate('document.body.dataset.wallpaper')=='none'
 assert not errors,errors
 browser.close()
print('81 test coverage complement: glass and wallpaper interactions passed, 6 window widths')
