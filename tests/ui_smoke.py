"""Visual smoke-test (developer-only; requires Playwright + Chromium).
No credentials or real applications are used."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
jobid='a'*22
model={'name':'qwen2.5:3b','size':2_000_000_000,'parameters':'3B'}
state={
 'settings':{'theme':'dark','selectedModel':'qwen2.5:3b','monitoringEnabled':True,'autoPrepare':True,'telegramApprovalsEnabled':True,'telegramConfigured':True,'telegramChatId':'123456789','smtpConfigured':True,'smtpHost':'smtp.example.fr','smtpPort':587,'smtpUser':'candidate@example.fr','smtpFrom':'candidate@example.fr','excludeUnknownEducation':True,'intervalMinutes':60,'onboardingCompleted':True,'sourceEnabled':['arbeitnow','remotive'],'excludePrivateSchools':True,'sourceCredentialStatus':{}},
 'statuses':{'en_attente_validation':'Validation Telegram','dossier_prêt':'Dossier prêt','en_attente_reponse':'En attente de réponse'},
 'profile':{'name':'Camille Martin','email':'candidate@example.fr','education':'Bachelor','level':'3','roles':'Développeur','skills':'JavaScript Python','location':'Paris','rhythm':'3j/2j','experience':''},
 'documents':{'cv':{'name':'cv.pdf','text':'Camille Martin. Développeuse','importedAt':'2026-10-14'},'letter':{'name':'lettre.docx','text':'Bonjour, je postule.','importedAt':'2026-10-14'}},
 'outputs':{jobid:{'cv':'Camille Martin. Développeuse Python et JavaScript.','letter':'Bonjour, je souhaite rejoindre votre équipe. Cordialement Camille.'}},
 'jobs':[{'id':jobid,'title':'Alternance Développeur Python','company':'Exemple','location':'Paris','description':'Recherche un étudiant Bac+3 en alternance','url':'https://example.fr/annonce','eligible':True,'score':85,'status':'en_attente_validation','applicationEmail':'rh@example.fr','addedAt':'2026-10-14','history':[{'at':'2026-10-14T12:00:00Z','event':'CV préparé','detail':'Modèle Ollama local'},{'at':'2026-10-14T12:02:00Z','event':'Demande de validation','detail':'Documents envoyés'}]}],
 'rules':[{'id':'education-default','field':'education','value':'3','enabled':True,'mode':'any'}],
 'boards':[], 'sources':[{'id':'arbeitnow','name':'Arbeitnow','auth':'none','region':'Europe','note':'Sans clé'},{'id':'remotive','name':'Remotive','auth':'none','region':'Global','note':'API publique'},{'id':'adzuna','name':'Adzuna France','auth':'keypair','region':'France','note':'Clés gratuites'}],
 'monitoring':{'lastScanAt':'2026-10-14T13:00:00Z','lastResult':{'imported':1,'notified':1,'errors':[]},'sourceResults':[{'id':'arbeitnow','status':'ok','count':18}]},
 'runtime':{'scanning':False,'lastError':''}
}
html=(root/'renderer/index.html').read_text()
html=html.replace('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'" />','')
html=html.replace('<link rel="stylesheet" href="style.css" />','<style>'+(root/'renderer/style.css').read_text()+'</style>')
html=html.replace('<script defer src="app.js"></script>','')
mock=f'''window.__mockState={json.dumps(state,ensure_ascii=False)}; window.__lastSavedSettings=null; window.radar={{state:async()=>structuredClone(window.__mockState),saveSettings:async changes=>{{window.__lastSavedSettings=changes;window.__mockState.settings={{...window.__mockState.settings,...changes}};return structuredClone(window.__mockState);}},system:async()=>({{platform:'darwin',totalGb:16,freeGb:12,recommended:'qwen2.5:7b'}}),models:async()=>({{connected:true,models:[{json.dumps(model)}]}})}};'''
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
    page=browser.new_page(viewport={'width':1450,'height':970},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html)
    page.evaluate(mock)
    page.add_script_tag(content=(root/'renderer/job-sort.js').read_text());page.add_script_tag(content=(root/'renderer/app.js').read_text())
    page.locator('[data-nav="applications"]').first.click()
    assert page.locator('text=Tous mes dossiers').count()==1
    page.locator('[data-action="application-detail"]').first.click()
    assert page.locator('text=Historique de cette candidature').count()==1
    assert page.locator('[data-action="telegram-review"]').count()==1
    page.screenshot(path=str(root/'preview-suivi.png'),full_page=True)
    page.locator('[data-nav="monitor"]').first.click()
    assert page.locator('#smtp-form').count()==1
    assert page.locator('#sources-form').count()==1
    assert page.locator('text=Sources automatiques').count()==1
    assert page.locator('#telegram-form').count()==1
    # Régression v0.5 : la case monitoringEnabled était mal formée dans l’HTML.
    assert page.locator('#monitor-form input[name="monitoringEnabled"]').count()==1
    page.locator('#monitor-form input[name="monitoringEnabled"]').uncheck()
    page.locator('#monitor-form button[type="submit"]').click()
    page.wait_for_function("window.__lastSavedSettings !== null")
    assert page.evaluate("window.__lastSavedSettings.monitoringEnabled") is False
    assert page.locator('text=Surveillance configurée.').count()==1
    page.screenshot(path=str(root/'preview-telegram.png'),full_page=True)
    page.locator('[data-nav="documents"]').first.click()
    assert page.locator('select[name="level"]').count()==1
    page.locator('[data-nav="settings"]').first.click()
    assert page.locator('text=Le créateur n’a pas accès à tes données personnelles.').count()==1
    assert page.locator('text=Gratuit à télécharger et à utiliser.').count()==1
    page.screenshot(path=str(root/'preview-confidentialite.png'),full_page=True)
    assert not errors,errors
    browser.close()
print('UI workflow OK; aperçus générés avec données fictives.')
