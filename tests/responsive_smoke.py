"""Manual UI smoke test; requires Python Playwright and Chromium. No private data."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
ns={'__file__':str(root/'tests/ui_smoke.py')}
source=(root/'tests/ui_smoke.py').read_text().split('with sync_playwright() as pw:')[0]
exec(source,ns)
html=ns['html']; state=ns['state']; model=ns['model']; mock=ns['mock']
widths=[(1680,920),(1440,900),(1280,800),(1024,768),(900,700),(760,680)]
views=['dashboard','jobs','documents','applications','rules','monitor','settings']
with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
  page=browser.new_page(viewport={'width':1440,'height':900})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.evaluate(mock)
  page.evaluate('window.radar.onModelPull=()=>{}')
  page.add_script_tag(content=(root/'renderer/job-sort.js').read_text());page.add_script_tag(content=(root/'renderer/app.js').read_text())
  page.wait_for_selector('.app-shell',timeout=10000)
  failures=[]
  for width,height in widths:
    page.set_viewport_size({'width':width,'height':height})
    for view in views:
      page.evaluate('(v)=>{ui.page=v; ui.jobId="";render()}',view)
      metrics=page.evaluate('''()=>({rootWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
        mainWidth:document.querySelector('.main-area').scrollWidth,mainClient:document.querySelector('.main-area').clientWidth,
        sidebarWidth:document.querySelector('.sidebar').scrollWidth,sidebarClient:document.querySelector('.sidebar').clientWidth,
        layout:document.querySelector('.app-shell').getBoundingClientRect().width,
        zeroButtons:[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width<15||r.height<15}).length,
        offscreenButtons:[...document.querySelectorAll('main button')].filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).length,
      })''')
      if metrics['rootWidth']>width+1 or metrics['bodyWidth']>width+1 or metrics['mainWidth']>metrics['mainClient']+1 or metrics['offscreenButtons']:
        failures.append((width,height,view,metrics))
    if width==1280:
      page.evaluate("ui.page='dashboard';render()")
      page.screenshot(path=str(root/'preview-dashboard-v0.9.0.png'))
    if width==900:
      page.evaluate("ui.page='documents';render()")
      page.screenshot(path=str(root/'preview-compact-v0.9.0.png'))
  browser.close()
  assert not errors, errors
  assert not failures, json.dumps(failures,ensure_ascii=False,indent=2)
print('Responsive UI validated:', ', '.join(f'{w}×{h}' for w,h in widths),'·',len(views),'screens each')
