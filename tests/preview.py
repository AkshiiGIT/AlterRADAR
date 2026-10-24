from playwright.sync_api import sync_playwright
import json, datetime, pathlib, subprocess, time
p=pathlib.Path(__file__).parents[1]
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
raw={
 'schema':1, 'settings':{'theme':'dark','selectedModel':'qwen2.5:3b'},
 'profile':{'name':'Camille Martin','email':'camille@example.com','education':'Bachelor développement web','roles':'Développeur full-stack','skills':'React TypeScript Python','location':'Paris','rhythm':'3 semaines / 1 semaine','experience':'Projet React réalisé en équipe.'},
 'documents': {'cv': {'name':'CV-Camille-Martin.pdf','text':'Camille Martin\nDéveloppement Web\nExpérience React','importedAt':now},'letter':{'name':'lettre-motivation.docx','text':'Bonjour, je souhaite une alternance.','importedAt':now}},
 'jobs':[
  {'id':'a1','company':'Doctolib','title':'Développeur Front-end React — Alternance','location':'Paris · Hybride','description':'Alternance développeur React TypeScript.','status':'nouvelle','score':94,'addedAt':now,'url':'https://example.com/1'},
  {'id':'a2','company':'Back Market','title':'Software Engineer — Alternance','location':'Paris','description':'Apprentissage software engineer.','status':'prête','score':87,'addedAt':now,'url':'https://example.com/2'},
  {'id':'a3','company':'Qonto','title':'Développeur Full-stack en alternance','location':'Paris','description':'Apprentissage React Python.','status':'postulée','score':81,'addedAt':now,'url':'https://example.com/3'},
  {'id':'a4','company':'Alan','title':'Alternance Product Developer','location':'Remote','description':'React Next JS.','status':'nouvelle','score':77,'addedAt':now,'url':'https://example.com/4'},
 ], 'outputs':{}
}
mock = f'''window.radar = {{
 state:async()=>structuredClone({json.dumps(raw,ensure_ascii=False)}),
 system:async()=>({{platform:'darwin',totalGb:16,freeGb:10.5,recommended:'qwen2.5:7b',cores:8}}),
 models:async()=>({{connected:true,models:[{{name:'qwen2.5:3b',size:2190000000,parameters:'3B',quantization:'Q4_K_M'}},{{name:'qwen2.5:7b',size:4720000000,parameters:'7B',quantization:'Q4_K_M'}}]}}),
 saveSettings:async(v)=>{{let n = structuredClone({json.dumps(raw,ensure_ascii=False)}); n.settings={{...n.settings,...v}};return n;}},
 openUrl:async()=>{{}},openOllama:async()=>{{}}
}}'''
server=subprocess.Popen(['python','-m','http.server','8769','--bind','127.0.0.1'],cwd=p,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(.6)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu','--allow-file-access-from-files'])
  page=browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
  html=(p/'renderer/index.html').read_text()
  import re
  html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
  html=html.replace('<link rel="stylesheet" href="style.css" />','<style>'+(p/'renderer/style.css').read_text()+'</style>')
  html=html.replace('<script defer src="app.js"></script>','')
  page.set_content(html)
  page.evaluate(mock)
  page.add_script_tag(content=(p/'renderer/job-sort.js').read_text());page.add_script_tag(content=(p/'renderer/app.js').read_text())
  page.wait_for_selector('.hero',timeout=10000)
  page.screenshot(path=str(p/'preview-dashboard.png'),full_page=True)
  page.evaluate("ui.state.settings.theme='light';render()")
  page.screenshot(path=str(p/'preview-light.png'),full_page=True)
  page.evaluate("ui.state.settings.theme='dark';render()")
  page.locator('[data-nav="settings"]').first.click()
  page.wait_for_selector('.model-option')
  page.screenshot(path=str(p/'preview-settings.png'),full_page=True)
  page.locator('[data-nav="documents"]').first.click()
  page.screenshot(path=str(p/'preview-documents.png'),full_page=True)
  browser.close()
finally:
 server.terminate()
print('Previews written')
