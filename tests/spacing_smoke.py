"""Validate true visual gaps between the offers page panels at laptop resolutions."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
ns={'__file__':str(root/'tests/ui_smoke.py')}
exec((root/'tests/ui_smoke.py').read_text().split('with sync_playwright() as pw:')[0],ns)
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.set_content(ns['html'])
    page.evaluate(ns['mock'])
    page.evaluate('window.radar.onModelPull=()=>{}')
    page.add_script_tag(content=(root/'renderer/app.js').read_text())
    page.wait_for_selector('.app-shell')
    for width,height in [(1440,900),(1280,800),(1024,768),(760,680)]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate("ui.page='jobs';ui.jobId='';render()")
        blocks=page.evaluate('''()=>[...document.querySelectorAll('.jobs-page > *')].map(e=>({name:e.className,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}))''')
        gaps=[round(blocks[i+1]['top']-blocks[i]['bottom'],1) for i in range(len(blocks)-1)]
        assert all(g>=18 for g in gaps),(width,blocks,gaps)
        print(f'{width}x{height}: espaces offres {gaps}')
    browser.close()
