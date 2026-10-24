'use strict';
const nav = [
  ['dashboard','Tableau de bord','grid'],
  ['jobs','Offres & stages','briefcase'],
  ['documents','Mes documents','file'],
  ['applications','Candidatures','send'],
  ['rules','Règles de tri','filter'],
  ['monitor','Surveillance & Telegram','clock'],
  ['settings','Paramètres','settings']
];
const RULE_LABELS={education:'Niveau d’études maximum requis',location_include:'Ville / zone autorisée',location_exclude:'Ville / zone interdite',title_include:'Mots-clés dans le titre',text_include:'Mots-clés obligatoires',text_exclude:'Mots-clés interdits',company_exclude:'Entreprises interdites',min_score:'Score minimal',contract:'Alternance obligatoire',remote:'Télétravail obligatoire'};
// Le choix « un ou tous » ne s'applique qu'aux critères utilisant des mots-clés.
const RULE_KEYWORD_FIELDS = new Set(['location_include','location_exclude','title_include','text_include','text_exclude','company_exclude']);
const RULE_EXCLUSION_FIELDS = new Set(['location_exclude','text_exclude','company_exclude']);
function ruleMatchOptions(mode,field){
  const visible=RULE_KEYWORD_FIELDS.has(field);
  return `<select name="mode" aria-label="Combinaison des mots-clés" ${visible?'':'hidden disabled'}><option value="any" ${mode!=='all'?'selected':''}>Au moins un mot-clé</option><option value="all" ${mode==='all'?'selected':''}>Tous les mots-clés</option></select>`;
}
function ruleMatchHint(field,mode='any'){
  if(field==='education')return 'Exemple : 3 = exclure les offres exigeant Bac+4 ou Bac+5. Aucun choix de mots-clés nécessaire.';
  if(field==='min_score')return 'Exemple : 70 = conserver les offres dont le score atteint au moins 70/100.';
  if(field==='contract')return 'Conserve uniquement les offres d’alternance.';
  if(field==='remote')return 'Conserve uniquement les offres mentionnant le télétravail.';
  const condition=mode==='all'?'tous les mots-clés sont présents':'au moins un mot-clé est présent';
  const excluded=RULE_EXCLUSION_FIELDS.has(field);
  return `${excluded?'Annonce exclue':'Annonce conservée'} si ${condition}. Sépare les valeurs par des virgules (ex. Paris, Lyon).`;
}
function syncRuleMatchUI(fieldSelect){
  const form=fieldSelect.closest('form');
  if(!form||(!form.classList.contains('rule-edit-form')&&form.id!=='new-rule-form'))return;
  const mode=form.querySelector('select[name="mode"]');
  const hint=form.querySelector('.rule-match-hint');
  const value=form.querySelector('input[name="value"]');
  if(!mode)return;
  const field=fieldSelect.value;
  const keyword=RULE_KEYWORD_FIELDS.has(field);
  mode.hidden=!keyword;
  mode.disabled=!keyword;
  if(value){
    const numeric=field==='education'||field==='min_score';
    const unused=field==='contract'||field==='remote';
    value.hidden=unused;
    value.disabled=unused;
    value.type=numeric?'number':'text';
    if(numeric){value.min=field==='education'?'1':'0';value.max=field==='education'?'8':'100';value.step='1';}
    else{value.removeAttribute('min');value.removeAttribute('max');value.removeAttribute('step');}
    value.placeholder=field==='education'?'Ex. 3':field==='min_score'?'Ex. 70':keyword?'Ex. Paris, Lyon':'';
    value.setAttribute('aria-label',field==='education'?'Niveau Bac plus':field==='min_score'?'Score minimum':'Valeurs de la règle');
  }
  if(hint)hint.textContent=ruleMatchHint(field,mode.value);
}

const STATUS = ['nouvelle','à examiner','cv_en_cours','lettre_en_cours','dossier_prêt','en_attente_validation','à_revoir','validée','à_envoyer','en_cours_envoi','postulée','en_attente_reponse','entretien','refusée','acceptée','erreur_envoi'];
const statusName = key => ui.state?.statuses?.[key] || key;
const ui = {page:'onboarding',state:null,system:null,models:{connected:false,models:[],error:''},jobId:'',search:'',filter:'toutes',docKind:'cv',detailKind:'letter',busy:false,dirty:false,toast:null,telegramPairing:null,modelProgress:null,modelCatalog:[],wallpaperData:'',geoDraft:null,telegramHealth:null,jobDistances:{},distanceStatus:'',distanceLoading:false,distanceRequest:0,distanceVersion:'',geoExpanded:false};
const appEl = document.getElementById('app');

const icon = (name,cls='') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const esc = value => String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const nfmt = n => new Intl.NumberFormat('fr-FR').format(n);
const datefmt = date => {try{return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'}).format(new Date(date));}catch{return ''}};
// Une date de publication n'est pas la date à laquelle AlterRADAR a trouvé l'offre.
// Ne jamais afficher "Publiée" si seule la date de découverte est disponible.
function jobDateDisplay(job){
  const value=String(job.publishedAt||'').trim();
  const parsed=value?new Date(value):null;
  const trusted=parsed&&Number.isFinite(parsed.getTime())&&!((job.atsId||'').toLowerCase()==='greenhouse'&&!job.publicationEvidence);
  if(trusted){
    const date=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric'}).format(parsed);
    return {text:`Publiée le ${date}`,kind:'published',title:job.publicationEvidence||'Date fournie par la source de l’annonce.'};
  }
  const inaccessible=job.dateCheckStatus==='error';
  const checked=Boolean(job.dateCheckedAt);
  const reason=String(job.dateCheckError||'').slice(0,100);
  return {text:inaccessible?'Date non vérifiable':checked?'Date non communiquée':'Date à vérifier',kind:'unknown',title:inaccessible?`La consultation de la page a échoué${reason?' : '+reason:''}. Clique sur « Vérifier sur le site » pour réessayer.`:checked?'Page consultée, mais aucune date de publication prouvée.':'Vérification en attente : clique sur « Vérifier sur le site » pour lancer le contrôle.'};
}
function jobDateBadge(job){
  const info=jobDateDisplay(job);
  return `<span class="offer-date-badge ${info.kind}" data-publication-id="${esc(job.id||'')}" title="${esc(info.title)}">${icon('clock','s')} ${esc(info.text)}</span>`;
}

const initials = name => (String(name||'RA').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()||'RA');
const gb = size => `${(Number(size||0)/1e9).toFixed(1)} Go`;
// L'état est éphémère et provient du flux /api/pull local d'Ollama.
const pullByteLabel = value => {
  if(!Number.isFinite(value)||value<0)return '—';
  return value>=1e9?`${(value/1e9).toFixed(2)} Go`:value>=1e6?`${(value/1e6).toFixed(1)} Mo`:`${(value/1e3).toFixed(0)} Ko`;
};
const pullEtaLabel = seconds => {
  if(!Number.isFinite(seconds)||seconds<0)return 'Calcul en cours';
  if(seconds<60)return `≈ ${Math.max(1,Math.ceil(seconds))} s`;
  if(seconds<3600)return `≈ ${Math.ceil(seconds/60)} min`;
  return `≈ ${Math.floor(seconds/3600)} h ${Math.ceil((seconds%3600)/60)} min`;
};
function modelPullMarkup(){
  const p=ui.modelProgress;
  if(!p)return '';
  const active=p.active===true;
  const known=Number.isFinite(p.percent)&&p.percent>=0&&p.percent<=100;
  const percent=known?Math.round(p.percent):null;
  const isError=Boolean(p.error);
  const detail=Number.isFinite(p.completed)&&Number.isFinite(p.total)&&p.total>0;
  return `<section class="model-pull-panel ${isError?'is-error':''}" aria-label="Téléchargement du modèle Qwen">
    <div class="model-pull-heading"><div class="model-pull-symbol">${icon(active?'download':isError?'info':'check','s')}</div><div class="model-pull-title"><strong>${active?'Installation de Qwen':p.cancelled?'Téléchargement interrompu':isError?'Téléchargement échoué':'Modèle IA prêt'}</strong><small>${esc(p.model||'Qwen · Ollama local')}</small></div><div class="model-pull-actions">${active?`<button type="button" class="btn small" data-action="cancel-model-pull" ${p.cancelling?'disabled':''}>${p.cancelling?'Arrêt…':'Annuler'}</button>`:`<button type="button" class="model-pull-close" data-action="dismiss-model-pull" aria-label="Fermer le suivi du téléchargement">×</button>`}</div></div>
    <div class="model-pull-stage">${esc(p.status||'Préparation du téléchargement…')}</div>
    <div class="model-pull-meter"><div class="model-pull-track ${!known&&active?'is-indeterminate':''}" ${known?`role="progressbar" aria-label="Progression du fichier courant" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"`:'role="status" aria-label="Progression indisponible"'}><div class="model-pull-fill" style="width:${known?percent:0}%"></div></div><strong class="model-pull-percent">${known?`${percent} %`:active?'En cours':'—'}</strong></div>
    <div class="model-pull-stats"><span>${detail?`${pullByteLabel(p.completed)} / ${pullByteLabel(p.total)}`:'Taille non communiquée'}</span><span>${active&&p.speedBytesPerSecond?`${pullByteLabel(p.speedBytesPerSecond)}/s`:'—'}</span><span>${active?pullEtaLabel(p.etaSeconds):p.cancelled?'Interrompu':isError?'Échec':p.done?'Terminé':'—'}</span></div>
    <p class="model-pull-explanation">${active?'Progression du fichier en cours signalée par Ollama, pas du modèle entier. Le pourcentage peut repartir à zéro pour un autre fichier.':p.cancelled?'Les fichiers partiellement téléchargés peuvent rester en cache chez Ollama.':isError?'Tu peux réessayer depuis Paramètres après avoir corrigé le problème.':'Le modèle est désormais utilisable dans AlterRADAR.'}</p>
  </section>`;
}
function paintModelPull(){
  const inline=document.getElementById('model-pull-inline');
  if(inline)inline.innerHTML=modelPullMarkup();
  const dock=document.getElementById('model-pull-dock');
  if(dock){dock.hidden=ui.page==='settings'||!ui.modelProgress;dock.innerHTML=dock.hidden?'':modelPullMarkup();}
}
async function startQwenDownload(model=null){
  if(ui.modelProgress?.active){tip('Un téléchargement est déjà en cours.','error');return;}
  ui.modelProgress={model:model||ui.system?.recommended||'Qwen',status:'Connexion à Ollama…',percent:null,active:true};
  paintModelPull();
  if(ui.page==='settings')render(); // Une seule fois pour désactiver les autres boutons installer.
  try{
    const result=model?await window.radar.installModel(model):await window.radar.installRecommendedModel();
    // Refresh cached model data without rebuilding the form on another page.
    const [models,state]=await Promise.all([window.radar.models(),window.radar.state()]);
    ui.models=models;ui.state=state;
    if(ui.page==='settings'&&!ui.dirty&&!document.querySelector('input:focus, textarea:focus, select:focus'))render();
    tip(result.alreadyInstalled?'Modèle Qwen sélectionné.':'Modèle Qwen installé et sélectionné.');
  }catch(error){
    if(ui.modelProgress?.active){ui.modelProgress={...ui.modelProgress,status:String(error.message||'Échec de l’installation'),active:false,error:true,done:true};paintModelPull();}
    if(!ui.modelProgress?.cancelled)tip(error?.message||'Le téléchargement a échoué.','error');
  }finally{
    if(ui.page==='settings'&&!ui.dirty&&!document.querySelector('input:focus, textarea:focus, select:focus'))render();
  }
}

const mask = status => ['entretien','acceptée','en_attente_reponse','postulée'].includes(status) ? 'good' : (['refusée','erreur_envoi','à_revoir'].includes(status) ? 'warn' : '');
const modelIsUsable = () => ui.models.connected && ui.models.models.some(x=>x.name===ui.state.settings.selectedModel);
const link = (action,label,extra='') => `<button type="button" class="link-button" data-action="${action}" ${extra}>${label}</button>`;
function tip(message, type='success') {
  ui.toast={message,type}; drawToast();
  clearTimeout(tip.timer);
  tip.timer=setTimeout(()=>{ui.toast=null;drawToast()},4500);
}
function drawToast() {
  let el=document.querySelector('.toast-wrap');
  if(!el) {el=document.createElement('div');el.className='toast-wrap';document.body.appendChild(el)}
  el.innerHTML=ui.toast?`<div class="toast ${ui.toast.type}" role="status">${esc(ui.toast.message)}</div>`:'';
}
function getDocumentLabel(kind){return kind==='cv'?'CV':'Lettre de motivation'}
function shownJobs(){
  // Le compteur du menu et celui de la page utilisent exactement la même liste.
  const filtered=(ui.state?.jobs||[]).filter(j=>j.eligible).filter(j=>{
    const hay=`${j.title} ${j.company} ${j.location}`.toLowerCase();
    if(ui.page==='jobs' && (!hay.includes(ui.search.toLowerCase()) ||
      !(ui.filter==='toutes'||(ui.filter==='alternance'&&j.contractTypes?.includes('alternance'))||
        (ui.filter==='stage'&&j.contractTypes?.includes('stage'))||(ui.filter==='fort'&&j.score>=60))))return false;
    return true;
  });
  return window.AlterRadarJobSort.sortJobs(filtered,ui.state?.settings?.jobsSort||'score',ui.jobDistances);
}
function sidebar(){
  const {profile}=ui.state;
  const compatible=shownJobs().length;
  return `<aside class="sidebar">
    <div class="brand"><span class="brand-mark">${icon('radar')}</span><span>Alter<span style="color:var(--accent)">RADAR</span></span></div>
    ${!ui.state.settings.onboardingCompleted?`<button class="nav-item ${ui.page==='onboarding'?'active':''}" data-nav="onboarding" title="Créer mon profil" aria-label="Créer mon profil" style="margin-bottom:9px">${icon('sparkles')}<span>Créer mon profil</span></button>`:''}
    <div class="nav-label">ESPACE DE TRAVAIL</div>
    <div class="nav-group">${nav.slice(0,6).map(([id,title,glyph])=>`<button class="nav-item ${ui.page===id?'active':''}" data-nav="${id}" title="${esc(title)}" aria-label="${esc(title)}">${icon(glyph)}<span>${title}</span>${id==='jobs'?`<span class="nav-count" title="${compatible} offre(s) compatible(s) affichée(s)">${compatible}</span>`:''}</button>`).join('')}</div>
    <div class="nav-label" style="margin-top:29px">PRÉFÉRENCES</div>
    <div class="nav-group">${nav.slice(6).map(([id,title,glyph])=>`<button class="nav-item ${ui.page===id?'active':''}" data-nav="${id}" title="${esc(title)}" aria-label="${esc(title)}">${icon(glyph)}<span>${title}</span></button>`).join('')}</div>
    <div class="sidebar-bottom"><div class="privacy-pill">${icon('shield')}<div><strong>Données privées</strong><br>Local, sauf envois autorisés.</div></div>
    <button class="side-profile" data-nav="documents" title="Mes documents" aria-label="Mes documents" style="width:100%;text-align:left;cursor:pointer"><span class="avatar">${esc(initials(profile.name))}</span><span><strong>${esc(profile.name||'Mon espace')}</strong><small>Compte local · ${ui.system?.platform==='darwin'?'macOS':ui.system?.platform==='win32'?'Windows':'Desktop'}</small></span>${icon('chevron','s')}</button></div>
  </aside>`;
}
function topbar(){
  return `<header class="topbar"><div class="eyebrow">L’ESSENTIEL, SANS LE BRUIT.</div>${ui.busy?`<div class="task-progress" role="status"><span class="loader"></span> Une opération est en cours · navigation disponible</div>`:''}<div class="topright"><span class="desktop-tag">${ui.models.connected ? `<span style="color:var(--success)">●</span> Ollama connecté` : '<span style="color:var(--warning)">●</span> Ollama hors ligne'}</span><button class="icon-button" data-action="theme" title="Changer de thème" aria-label="Changer de thème">${icon(ui.state.settings.theme==='dark'?'sun':'moon')}</button><span class="avatar" style="width:35px;height:35px;border-radius:50%">${esc(initials(ui.state.profile.name))}</span></div></header>`;
}
function pageHeader(kicker,title,subtitle='',action='') {
  return `<div class="page-title" style="display:flex;justify-content:space-between;align-items:end;gap:18px"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${subtitle?`<p class="subheading">${subtitle}</p>`:''}</div>${action}</div>`;
}
function jobRow(job){const dist=ui.jobDistances[job.id];const distanceHint=ui.state?.settings?.jobsSort==='distance'?`<span class="distance-badge" title="Distance approximative entre communes, si localisées">${typeof dist==='number'?`≈ ${dist} km`:'Lieu non localisé'}</span>`:'';return `<button class="job-row" data-action="select-job" data-id="${esc(job.id)}"><span class="company-logo">${esc(initials(job.company))}</span><span class="job-main"><span class="job-name">${esc(job.title)}</span><span class="job-meta">${esc(job.company)} · ${esc(job.contractTypes?.join(' / ')||'Type non identifié')} · ${esc(job.location||'Lieu non précisé')} · ${esc(job.source||'Source non indiquée')} · ${esc(job.atsName&&job.atsId?`ATS : ${job.atsName}`:'ATS non identifié')}</span><span class="offer-date-line">${jobDateBadge(job)}</span></span>${distanceHint}<span class="score-badge" title="Indice d’affinité, pas une probabilité de recrutement">${job.score}/100</span>${icon('chevron','s chevron')}</button>`}
function rolesHint(){const suggestions=ui.state.roleSuggestions||[];return `<p class="note" style="margin-top:8px">${suggestions.length?`Métiers déduits du CV et du cursus : <strong>${esc(suggestions.slice(0,9).join(' · '))}</strong>. Ils ne sont pas obligatoires : tu peux les personnaliser.`:'Importe ton CV pour découvrir automatiquement les métiers compatibles avec tes compétences et ta formation.'}</p>`;}
function contractCheckboxes(settings){
  const types=settings.searchTypes||['alternance'];
  return `<div class="field full contract-choice"><label>Quel type d'opportunité recherches-tu ?</label><div class="contract-options"><label class="hint-check"><input type="checkbox" name="searchTypes" value="alternance" ${types.includes('alternance')?'checked':''}/> Alternance</label><label class="hint-check"><input type="checkbox" name="searchTypes" value="stage" ${types.includes('stage')?'checked':''}/> Stage</label></div><p class="note">Tu peux cocher les deux. Modifiable à tout moment, sans recréer ton profil.</p></div>`;
}
function selectedContracts(form){return [...form.querySelectorAll('input[name="searchTypes"]:checked')].map(x=>x.value);}
function contractTitle(settings){const types=settings.searchTypes||['alternance'];return types.length===2?'stages et alternances':types.includes('stage')?'stages':'alternances';}
function onboarding(){
  const docs=ui.state.documents,p=ui.state.profile;
  return `${pageHeader('BIENVENUE SUR ALTERRADAR','Créons ton profil candidat','Importe ton CV et une ancienne lettre si tu en as une. AlterRADAR déduit les métiers possibles et cherche des stages et/ou alternances, sans URL ni intitulé de poste à renseigner.')}
  <section class="hero"><div class="hero-content"><div class="hero-eyebrow">${icon('sparkles','s')} CONFIGURATION PERSONNELLE</div><h2>Ton CV. Tes métiers. Tes opportunités.</h2><p>AlterRADAR est destiné aux étudiants et candidats. Aucun compte recruteur, aucune annonce à publier, aucun lien d’entreprise à saisir.</p></div><div class="hero-orb" aria-hidden="true"></div></section>
  <section class="card space-top"><div class="card-header"><h2>1. Tes documents</h2><span class="tag">Local sur ton appareil</span></div>
  <div class="doc-grid">${['cv','letter'].map(kind=>`<div class="doc-card"><span class="doc-glyph">${icon('file','l')}</span><div class="doc-details"><div class="doc-title">${kind==='cv'?'Importer votre CV':'Importer une lettre de motivation utilisée précédemment'}</div><div class="doc-sub">${docs[kind]?esc(docs[kind].name):kind==='cv'?'Requis · PDF, DOCX ou TXT':'Recommandé · PDF, DOCX ou TXT'}</div><button class="btn small ${docs[kind]?'':'primary'}" data-action="import-document" data-kind="${kind}">${icon('upload','s')} ${docs[kind]?'Remplacer':'Importer'}</button></div></div>`).join('')}</div>
  <p class="note space-top">La lettre de motivation sert d’exemple de style et de souhaits professionnels, pas de preuve de diplôme. Aucun document n’est envoyé au créateur. Tu peux continuer sans ancienne lettre si tu n’en as pas.</p>
  <div class="inline-actions space-top"><button class="btn primary" data-action="build-profile" ${!docs.cv||ui.busy?'disabled':''}>${icon('sparkles','s')} ${ui.busy?'Analyse…':'Affiner mon profil avec l’IA (facultatif)'}</button><button class="btn small" data-nav="settings">Choisir le modèle IA</button></div></section>
  <section class="card space-top"><div class="card-header"><div><h2>Vérifie ton profil et lance le radar</h2><p class="subtitle">Les informations détectées peuvent être incomplètes. Vérifie notamment le niveau d’études.</p></div></div>
  <form id="profile-form"><div class="form-grid">${contractCheckboxes(ui.state.settings)}${field('Nom et prénom','name',p.name,'Prénom Nom')}${field('E-mail','email',p.email,'prénom@exemple.fr')}${field('Formation','education',p.education,'BUT Informatique, Bachelor…')}
  <div class="field"><label>Niveau actuel (filtre strict)</label><select name="level"><option value="">Non déterminé</option>${[1,2,3,4,5,6,7,8].map(n=>`<option value="${n}" ${String(p.level)===String(n)?'selected':''}>Bac+${n}</option>`).join('')}</select></div>
  ${field('Métiers proposés automatiquement (facultatif)','roles',p.roles,'Calculés depuis ton CV')}<div class="field full">${rolesHint()}</div>${field('Compétences','skills',p.skills,'Python, Cisco, React…')}${field('Localisation','location',p.location,'Paris / Île-de-France')}${field('Rythme','rhythm',p.rhythm,'3 semaines / 1 semaine')}
  <div class="field full"><label>Expériences et contraintes</label><textarea name="experience" rows="3">${esc(p.experience)}</textarea></div></div>
  <div class="form-actions"><label class="hint-check"><input type="checkbox" name="autoMonitor" checked/> Continuer à chercher automatiquement chaque heure (désactivable)</label><button class="btn primary" type="submit" ${!docs.cv?'disabled':''}>${icon('check','s')} Confirmer et lancer ma recherche</button></div></form></section>`;
}
function dashboard(){
  const {profile,documents}=ui.state;
  const jobs=ui.state.jobs.filter(j=>j.eligible);
  const sent=jobs.filter(x=>['postulée','en_attente_reponse','entretien','acceptée'].includes(x.status)).length;
  const ready=jobs.filter(x=>['dossier_prêt','en_attente_validation','validée','à_envoyer'].includes(x.status)).length;
  const topJobs=jobs.slice().sort((a,b)=>b.score-a.score).slice(0,4);
  return `
  ${pageHeader('VUE D’ENSEMBLE',`Bonjour${profile.name?', '+esc(profile.name.split(' ')[0]):''} <span style="color:var(--accent)">✳</span>`,'Ton prochain chapitre professionnel commence ici.')}
  <section class="hero"><div class="hero-content"><div class="hero-eyebrow">${icon('sparkles','s')} TON COPILOTE CARRIÈRE</div><h2>L’alternance qui te ressemble, enfin à portée de main.</h2><p>Découvre des opportunités, adapte tes candidatures avec ton IA locale et garde le contrôle à chaque étape.</p><button class="btn dark" data-nav="jobs">Explorer mes offres ${icon('arrow')}</button></div><div class="hero-orb" aria-hidden="true"></div></section>
  <section class="stat-grid"><div class="stat-card"><div class="stat-head"><span>Offres découvertes</span><span class="stat-icon">${icon('briefcase')}</span></div><div class="stat-value">${nfmt(jobs.length).padStart(2,'0')}</div><div class="stat-foot">Opportunités enregistrées</div></div><div class="stat-card"><div class="stat-head"><span>Candidatures envoyées</span><span class="stat-icon green">${icon('send')}</span></div><div class="stat-value">${nfmt(sent).padStart(2,'0')}</div><div class="stat-foot"><strong>${jobs.filter(x=>x.status==='entretien').length} entretien(s)</strong> enregistré(s)</div></div><div class="stat-card"><div class="stat-head"><span>Dossiers prêts</span><span class="stat-icon orange">${icon('file')}</span></div><div class="stat-value">${nfmt(ready).padStart(2,'0')}</div><div class="stat-foot">À relire, valider ou envoyer</div></div></section>
  <section class="two-cols"><div><div class="section-header"><h2>Offres sélectionnées</h2>${link('all-jobs',`Toutes les offres ${icon('arrow','s')}`)}</div><div class="card">${topJobs.length?`<div class="job-list">${topJobs.map(jobRow).join('')}</div>`:empty('briefcase','Aucune offre pour le moment','Lance une recherche automatique : AlterRADAR interroge plusieurs API sans ajouter de liens.',`<button class="btn primary" data-action="scan-now">${icon('refresh')} Lancer une recherche</button>`)}</div></div>
  <div><div class="section-header"><h2>Ton espace IA</h2><small>100 % local</small></div><div class="card ai-card"><span class="ai-icon">${icon('sparkles','xl')}</span><h3>Une candidature, à ton image.</h3><p class="lead">L’IA adapte tes documents aux offres sélectionnées. Tes expériences restent les tiennes, et tu valides chaque version.</p><div class="info-line">${icon('check','s')} ${documents.cv?'CV importé':'CV à importer'}</div><div class="info-line">${icon('check','s')} ${documents.letter?'Lettre importée':'Lettre à importer'}</div><div class="info-line">${icon('cpu','s')} ${modelIsUsable()?esc(ui.state.settings.selectedModel):'Modèle à configurer'}</div><button class="btn" data-nav="documents" style="margin-top:15px">Gérer mes documents ${icon('arrow')}</button></div></div></section>`;
}
function empty(glyph,title,caption,cta='') {return `<div class="empty">${icon(glyph,'l')}<strong>${esc(title)}</strong><p>${esc(caption)}</p>${cta}</div>`}
function jobs(){
  const filtered=shownJobs();
  const selected=ui.state.jobs.find(j=>j.id===ui.jobId&&j.eligible);
  return `<section class="jobs-page">${pageHeader('DÉCOUVRIR',`Offres de ${contractTitle(ui.state.settings)}`,'AlterRADAR filtre les métiers d’après ton CV et ton cursus. Aucune liste de métiers à saisir.',`<button class="btn primary" data-action="scan-now" ${ui.busy?'disabled':''}>${icon('refresh')} ${ui.busy?'Recherche en cours…':'Chercher maintenant'}</button>`)}
    <div class="alert">${icon('sparkles')}<span><strong>Tri des métiers : ${ui.state.settings.strictCareer!==false?'correspondance stricte':'recherche élargie'}.</strong> ${ui.state.settings.strictCareer!==false?'Seuls les postes liés à ton profil sont affichés.':'Les métiers différents de ton profil peuvent aussi apparaître.'} <button type="button" class="link-button" data-nav="rules">Modifier dans Règles de tri</button><br><small>${esc((ui.state.roleSuggestions||[]).slice(0,6).join(' · '))}</small></span></div>
    <div class="job-toolbar"><div class="search-field">${icon('search')}<input id="job-search" placeholder="Rechercher un poste, une entreprise, une ville…" value="${esc(ui.search)}" /></div><select id="job-filter" aria-label="Type d’offre"><option value="toutes" ${ui.filter==='toutes'?'selected':''}>Toutes les offres</option><option value="alternance" ${ui.filter==='alternance'?'selected':''}>Alternances</option><option value="stage" ${ui.filter==='stage'?'selected':''}>Stages</option><option value="fort" ${ui.filter==='fort'?'selected':''}>Score ≥ 60 %</option></select><label class="job-sort-control" for="job-sort"><span>Trier par</span><select id="job-sort" aria-label="Trier les offres"><option value="score" ${ui.state.settings.jobsSort==='score'?'selected':''}>Pertinence · score</option><option value="recent" ${ui.state.settings.jobsSort==='recent'?'selected':''}>Plus récentes</option><option value="distance" ${ui.state.settings.jobsSort==='distance'?'selected':''}>Plus proches</option></select></label></div>
    ${ui.state.settings.jobsSort==='distance'?`<p class="sort-explanation" role="status">${ui.distanceLoading?'Calcul de proximité en cours…':esc(ui.distanceStatus||'Les distances sont approximatives, calculées entre les centres de communes françaises. Les lieux inconnus arrivent en dernier.')}</p>`:ui.state.settings.jobsSort==='recent'?'<p class="sort-explanation">Date de publication quand disponible ; sinon date de découverte par AlterRADAR.</p>':''}
    ${geoSearchForm()}
    <div class="two-cols"><div class="card"><div class="card-header"><h3>${filtered.length} offre(s) compatibles</h3><span class="tag">${ui.state.jobs.length} analysées · ${ui.state.jobs.filter(j=>!j.eligible).length} exclue(s)</span></div>${filtered.length?`<div class="job-list">${filtered.map(jobRow).join('')}</div>`:empty('search','Aucune offre compatible pour le moment','AlterRADAR analyse les sources publiques automatiquement. Si aucune offre n’apparaît, regarde le diagnostic dans Surveillance ; des API peuvent être limitées ou nécessiter une clé gratuite.',`<button class="btn primary" data-nav="monitor">Voir les sources ${icon('arrow','s')}</button>`)}</div>
    <div class="column-flow">${selected?jobDetail(selected):`<div class="card">${empty('briefcase','Sélectionne une offre','Consulte l’annonce officielle, les contacts publics éventuels et prépare un dossier.')}</div>`}</div></div></section>`;
}
function jobDetail(job){
  const generated = ui.state.outputs[job.id] || {};
  const kind=ui.detailKind;
  const selectedReady=ui.state.documents[kind];
  const cvReady=Boolean(generated.cv?.trim());
  const letterReady=Boolean(generated.letter?.trim());
  const allReady=cvReady&&letterReady;
  const mailReady=Boolean(job.applicationEmail&&ui.state.settings.smtpConfigured&&ui.state.settings.smtpHost);
  const history=job.history||[];
  return `<div class="card selected-card"><div class="card-header"><div><h3>${esc(job.title)}</h3><div class="subtitle">${esc(job.company)} · ${esc(job.contractTypes?.join(' / ')||'Type non identifié')} · ${esc(job.location||'Non précisé')} · ${esc(job.source||'Source inconnue')} · ${esc(job.atsName&&job.atsId?`ATS : ${job.atsName}`:'ATS non identifié')}</div><div class="offer-date-detail" style="gap:8px">${jobDateBadge(job)} <button type="button" class="btn small ghost" data-action="verify-job-date" data-id="${esc(job.id)}" title="Consulter l’annonce officielle pour confirmer la date de publication">${icon('refresh','s')} Vérifier sur le site</button></div>${job.dateCheckStatus==='error'?`<p class="note" role="status">Échec de la consultation de la page : <strong>${esc(job.dateCheckError||'Erreur réseau ou refus du site')}</strong>. Ouvre l’annonce officielle pour vérifier manuellement.</p>`:job.dateCheckStatus==='unavailable'?'<p class="note" role="status">Page consultée, mais aucune date de publication vérifiable dans son contenu. Certaines plateformes chargent les annonces par JavaScript ou ne publient aucune date.</p>':''}</div><span class="score-badge">${job.score}/100</span></div>
    <div class="inline-actions"><button class="btn small" data-action="open-job" data-id="${esc(job.id)}">Voir l’offre ${icon('up-right','s')}</button><select class="status-select" data-id="${esc(job.id)}" aria-label="Statut de candidature">${STATUS.map(st=>`<option value="${esc(st)}" ${job.status===st?'selected':''}>${esc(statusName(st))}</option>`).join('')}</select></div>
    <div class="progress-line space-top"><span class="tag ${cvReady?'good':'warn'}">${icon(cvReady?'check':'clock','s')} CV ${cvReady?'rédigé':'à préparer'}</span><span class="tag ${letterReady?'good':'warn'}">${icon(letterReady?'check':'clock','s')} Lettre ${letterReady?'rédigée':'à préparer'}</span><span class="tag ${mask(job.status)}">${esc(statusName(job.status))}</span></div>
    <div class="rule"></div><h3>Pourquoi cette offre ?</h3><div class="match-explanation">${(job.matchExplanations||[]).map(reason=>`<p class="note">${icon('check','s')} ${esc(reason)}</p>`).join('') || '<p class="note">Aucune justification disponible.</p>'}<p class="note">Le score est indicatif, ce n’est pas une probabilité de recrutement.</p></div><div class="rule"></div><h3>Contact RH & envoi</h3><p class="note space-top">AlterRADAR préremplit une adresse professionnelle lorsqu’elle est publiée dans le texte de l’offre. Vérifie-la avant l’envoi. Aucune adresse n’est devinée ni extraite de profils LinkedIn privés.</p>
    <form class="job-recruiter-form space-top" data-id="${esc(job.id)}"><div class="form-grid"><div class="field"><label>Nom du contact RH (facultatif)</label><input name="recruiterName" value="${esc(job.recruiterName||'')}" placeholder="Nom réel, si connu" /></div><div class="field"><label>Fonction (facultatif)</label><input name="recruiterRole" value="${esc(job.recruiterRole||'')}" placeholder="Chargé(e) de recrutement" /></div><div class="field full"><label>Profil LinkedIn public du contact (facultatif)</label><input name="recruiterLinkedin" type="url" value="${esc(job.recruiterLinkedin||'')}" placeholder="https://www.linkedin.com/in/..." /></div><div class="field full"><label>E-mail officiel de candidature (facultatif)</label><input type="email" name="applicationEmail" value="${esc(job.applicationEmail||'')}" placeholder="recrutement@entreprise.fr" /></div></div><button class="btn small space-top" type="submit">Enregistrer les coordonnées</button></form>
    ${allReady ? `<div class="review-card space-top"><div><strong>CV et lettre préparés</strong><p class="note">Versions stockées localement et modifiables à tout moment.</p>${!job.draftVerified?`<p class="alert error space-top" role="alert">Vérification obligatoire avant validation ou envoi : ${esc(job.draftProblem||'Les documents doivent être enregistrés à nouveau pour cette offre.')}</p>`:''}</div><div class="inline-actions"><button class="btn primary small" data-action="telegram-review" data-id="${esc(job.id)}" ${!job.draftVerified||!ui.state.settings.telegramApprovalsEnabled||!ui.state.settings.telegramConfigured?'disabled':''}>${icon('send','s')} Envoyer à Telegram pour valider</button>${['validée','à_envoyer','erreur_envoi'].includes(job.status)&&job.approvedDigest?`<button class="btn small" data-action="email-draft" data-id="${esc(job.id)}">${icon('file','s')} Ouvrir .eml</button><button class="btn small" data-action="email-export" data-id="${esc(job.id)}">${icon('download','s')} Exporter .eml</button><button class="btn small ghost" data-action="email-copy" data-id="${esc(job.id)}">Copier l’e-mail</button>${ui.state.settings.deliveryMode==='auto'&&mailReady?`<button class="btn primary small" data-action="send-validated" data-id="${esc(job.id)}">Envoyer via SMTP</button>`:''}`:''}</div>${!ui.state.settings.telegramApprovalsEnabled?`<p class="note">${link('monitor-go','Configurer les validations Telegram')}</p>`:''}</div>`:''}
    ${job.status==='en_attente_validation'?`<div class="alert space-top">${icon('clock')} Dossier envoyé sur Telegram. Utilise « Valider » ou « À corriger » dans le message du bot.</div>`:''}
    ${job.status==='à_envoyer'?`<div class="alert space-top">${icon('info')} Dossier validé. Le brouillon .eml inclut les deux pièces jointes. Ouvre-le dans ton client e-mail pour vérifier l’adresse et envoyer manuellement ; le lien officiel de l’offre est disponible. L’ouverture du fichier .eml dépend du logiciel de messagerie.</div>`:''}
    <div class="rule"></div><h3 style="margin-bottom:11px">Description</h3><div class="description">${esc(job.description||'Description non fournie. Ouvre l’offre pour consulter les détails.')}</div>
    ${job.matchExplanations?.length?`<div class="note space-top"><strong>Pourquoi cet indice :</strong> ${esc(job.matchExplanations.join(' · '))}. Le score estime l’affinité, pas la chance d’être recruté.</div>`:''}
    <div class="rule"></div><div class="card-header" style="margin-bottom:11px"><h3>${icon('sparkles','s')} Adapter mes documents</h3></div><div class="filter-tabs"><button class="filter-tab ${kind==='letter'?'active':''}" data-action="detail-kind" data-kind="letter">Lettre</button><button class="filter-tab ${kind==='cv'?'active':''}" data-action="detail-kind" data-kind="cv">CV</button></div><p class="note space-top">${selectedReady?`Document source : ${esc(selectedReady.name)}.`:'Importe ce document dans Mes documents avant de lancer l’IA.'} Vérifie les faits avant la validation. Les exports DOCX/PDF sont prévus pour une seule page A4 ; un texte trop long doit être condensé.</p>
    <div class="inline-actions space-top"><button class="btn primary small" data-action="generate" data-kind="${kind}" data-id="${esc(job.id)}" ${!selectedReady||!modelIsUsable()||ui.busy?'disabled':''}>${icon('sparkles','s')} ${ui.busy?'Génération en cours…':'Adapter avec l’IA'}</button></div>
    ${generated[kind]?`<div class="field space-top"><label>Version adaptée — modifiable</label><textarea class="doc-preview" id="generated-text">${esc(generated[kind])}</textarea></div><div class="inline-actions space-top"><button class="btn small" data-action="save-generated" data-kind="${kind}" data-id="${esc(job.id)}">${icon('check','s')} Enregistrer</button>${['docx','pdf','txt'].map(fmt=>`<button class="btn small ghost" data-action="export" data-kind="${kind}" data-format="${fmt}" data-id="${esc(job.id)}">${icon('download','s')} ${fmt.toUpperCase()}</button>`).join('')}</div>`:''}
    ${!modelIsUsable()?`<p class="note space-top">${link('open-settings','Configurer mon modèle IA')}</p>`:''}
    <div class="rule"></div><div class="card-header"><h3>Historique de cette candidature</h3><span class="tag">${history.length} étape(s)</span></div>
    ${history.length?`<div class="event-timeline">${history.slice(0,15).map(h=>`<div class="event-item"><span class="event-dot"></span><div><strong>${esc(h.event)}</strong><small>${esc(new Date(h.at).toLocaleString('fr-FR'))}</small>${h.detail?`<p>${esc(h.detail)}</p>`:''}</div></div>`).join('')}</div>`:empty('clock','Pas encore d’historique','Les préparations, validations, envois et changements de statut apparaîtront ici.')}
    </div>`;
}

function documents(){
  const p=ui.state.profile,docs=ui.state.documents,kind=ui.docKind;
  return `${pageHeader('PROFIL & CANDIDATURES','Mes documents','Un profil, des versions adaptées à chaque opportunité.')}
    <div class="section-header"><h2>Documents de référence</h2><span class="tag">${icon('shield','s')} Stockage local</span></div>
    <section class="doc-grid">${['cv','letter'].map(k=>`<div class="doc-card"><span class="doc-glyph">${icon('file','l')}</span><div class="doc-details"><div class="doc-title">${getDocumentLabel(k)}</div><div class="doc-sub">${docs[k]?`${esc(docs[k].name)} · Importé le ${datefmt(docs[k].importedAt)}`:'Aucun document importé'}</div><div class="doc-actions"><button class="btn small ${docs[k]?'':'primary'}" data-action="import-document" data-kind="${k}">${icon('upload','s')} ${docs[k]?'Remplacer':'Importer'}</button>${docs[k]?`<button class="btn small ghost" data-action="document-kind" data-kind="${k}">${icon('edit','s')} Modifier</button>`:''}</div></div></div>`).join('')}</section>
    <div class="two-cols" style="margin-top:20px"><section class="card"><div class="card-header"><div><h3>Mon profil candidat</h3><p class="subtitle">Déduit du CV ; tu peux tout corriger avant de rechercher.</p></div>${icon('user')}</div>
    <button class="btn small space-top" data-action="build-profile" ${!docs.cv?'disabled':''}>${icon('sparkles','s')} Recréer le profil depuis mes documents</button><form id="profile-form" class="space-top"><div class="form-grid">
      ${field('Nom et prénom','name',p.name,'Ex. Camille Martin')}
      ${field('Adresse e-mail','email',p.email,'camille@mail.fr')}
      ${contractCheckboxes(ui.state.settings)}${field('Formation','education',p.education,'Ex. Bachelor développement web')}
      <div class="field"><label>Niveau d’études actuel (filtre strict)</label><select name="level"><option value="" ${!p.level?'selected':''}>Non défini (aucun filtre de niveau)</option>${[1,2,3,4,5,6,7,8].map(n=>`<option value="${n}" ${String(p.level)===String(n)?'selected':''}>Bac+${n}</option>`).join('')}</select></div>
      ${field('Métiers détectés (modifiables)','roles',p.roles,'Calculés automatiquement')}
      <div class="field full">${rolesHint()}</div>
      ${field('Compétences','skills',p.skills,'Ex. React, Python, SQL')}
      ${field('Ville / mobilité','location',p.location,'Ex. Paris / Remote')}
      <div class="field full">${fieldInner('Rythme de formation / disponibilité','rhythm',p.rhythm,'Ex. 3 semaines / 1 semaine')}</div>
      <div class="field full"><label>Expériences, réalisations, contraintes</label><textarea name="experience" rows="3" placeholder="Uniquement des faits réels…">${esc(p.experience)}</textarea></div>
    </div><div class="form-actions"><span class="note">Ton niveau active un filtre strict contre les offres exigeant un diplôme supérieur.</span><button class="btn primary" type="submit">${icon('check','s')} Enregistrer</button></div></form></section>
    <section class="column-flow"><div class="card"><div class="card-header"><h3>Éditer le document importé</h3>${icon('edit')}</div><div class="filter-tabs"><button data-action="document-kind" data-kind="cv" class="filter-tab ${kind==='cv'?'active':''}">CV</button><button data-action="document-kind" data-kind="letter" class="filter-tab ${kind==='letter'?'active':''}">Lettre</button></div>${docs[kind]?`<div class="field space-top"><label>Texte extrait (tu peux le corriger)</label><textarea id="source-text" class="doc-preview">${esc(docs[kind].text)}</textarea></div><button class="btn small space-top" data-action="save-document" data-kind="${kind}">${icon('check','s')} Sauvegarder les corrections</button>`:empty('upload','Document manquant','Importe un document au format PDF, DOCX, TXT ou MD.')}</div><div class="alert">${icon('info')}<span>Le texte du PDF/DOCX est extrait pour la réécriture. La mise en page originale n’est pas conservée dans les exports générés. Aucun document original n’est écrasé.</span></div></section></div>`;
}
function field(label,name,value,placeholder=''){return `<div class="field">${fieldInner(label,name,value,placeholder)}</div>`}
function fieldInner(label,name,value,placeholder=''){return `<label for="p-${name}">${esc(label)}</label><input id="p-${name}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="600" />`}
function applications(){
  const jobs=ui.state.jobs.filter(j=>j.status!=='nouvelle'||Boolean(ui.state.outputs[j.id]?.cv||ui.state.outputs[j.id]?.letter));
  const selected=jobs.find(j=>j.id===ui.jobId);
  const groups=[['Dossiers en préparation',jobs.filter(j=>['à examiner','cv_en_cours','lettre_en_cours','dossier_prêt','à_revoir'].includes(j.status)).length,'file'],['Validation / envoi',jobs.filter(j=>['en_attente_validation','validée','à_envoyer','en_cours_envoi','erreur_envoi'].includes(j.status)).length,'clock'],['En attente de réponse',jobs.filter(j=>['postulée','en_attente_reponse','entretien'].includes(j.status)).length,'send'],['Réponses finales',jobs.filter(j=>['acceptée','refusée'].includes(j.status)).length,'check']];
  return `${pageHeader('SUIVI COMPLET','Mes candidatures','Du CV en cours jusqu’à l’acceptation ou au refus : chaque étape est modifiable.')}
    <div class="inline-actions" style="justify-content:flex-end;margin-bottom:14px"><button class="btn small" data-action="refresh-followup">${icon('refresh','s')} Actualiser le suivi</button></div>
    <div class="stat-grid follow-grid">${groups.map(([label,count,glyph])=>`<div class="stat-card"><div class="stat-head">${label}<span class="stat-icon">${icon(glyph)}</span></div><div class="stat-value">${count}</div></div>`).join('')}</div>
    <div class="two-cols space-top"><div class="card"><div class="card-header"><h3>Tous mes dossiers</h3><span class="tag">${jobs.length} enregistrés</span></div>${jobs.length?`<div class="job-list">${jobs.map(j=>`<button class="job-row" data-action="application-detail" data-id="${esc(j.id)}"><span class="company-logo">${esc(initials(j.company))}</span><span class="job-main"><span class="job-name">${esc(j.title)}</span><span class="job-meta">${esc(j.company)} · CV : ${ui.state.outputs[j.id]?.cv?'prêt':'non rédigé'} · Lettre : ${ui.state.outputs[j.id]?.letter?'prête':'non rédigée'}</span></span><span class="tag ${mask(j.status)}">${esc(statusName(j.status))}</span>${icon('chevron','s')}</button>`).join('')}</div>`:empty('send','Aucun dossier commencé','Sélectionne une offre puis prépare ton CV et ta lettre.',`<button class="btn" data-nav="jobs">Explorer les offres ${icon('arrow','s')}</button>`)}</div>
    <div class="column-flow">${selected?jobDetail(selected):`<section class="card">${empty('file','Sélectionne une candidature','Modifie son statut, sa lettre, son CV et consulte son historique.')}</section>`}</div></div>
    <p class="note space-top">Les statuts sont modifiables manuellement à tout moment. « En attente de réponse » après SMTP indique l’acceptation par le serveur d’envoi, pas la garantie de réception du recruteur.</p>`;
}

function rulesPage(){
  const list=ui.state.rules||[];
  const opt=(field,selected)=>Object.entries(RULE_LABELS).map(([key,label])=>`<option value="${esc(key)}" ${field===key?'selected':''}>${esc(label)}</option>`).join('');
  return `${pageHeader('FILTRES STRICTS','Mes règles de tri','Tes critères passent avant le score de l’IA. Une offre rejetée est masquée et ne déclenche aucune alerte.')}<section class="card">
    <div class="card-header"><div><h3>Règles actives · ${list.filter(r=>r.enabled).length}</h3><p class="subtitle">Toutes les règles activées doivent être respectées.</p></div><span class="tag">${ui.state.jobs.filter(j=>!j.eligible).length} offre(s) exclue(s)</span></div>
    <div class="column-flow">${list.length?list.map(r=>`<form class="rule-row rule-edit-form" data-id="${esc(r.id)}"><div class="rule-top"><label class="hint-check"><input type="checkbox" name="enabled" ${r.enabled?'checked':''}/> Activer</label><button type="button" class="btn small ghost" data-action="rule-delete" data-id="${esc(r.id)}">Supprimer</button></div><div class="rule-form"><select name="field" aria-label="Type de règle">${opt(r.field,r.field)}</select><input name="value" value="${esc(r.value)}" placeholder="Ex. 3, Paris, Java…" maxlength="350"/>${ruleMatchOptions(r.mode,r.field)}<button class="btn small" type="submit">Enregistrer</button></div><p class="note rule-match-hint" aria-live="polite">${esc(ruleMatchHint(r.field,r.mode))}</p></form>`).join(''):empty('filter','Aucune règle','Ajoute une règle : sans règle active, aucune annonce ne sera exclue.')}</div>
    <div class="rule"></div><h3>Nouvelle règle</h3><form id="new-rule-form" class="rule-form space-top"><select name="field" aria-label="Type de nouveau filtre">${opt('text_exclude')}</select><input name="value" placeholder="Ex. Java, Paris, 3…" maxlength="350"/>${ruleMatchOptions('any','text_exclude')}<button class="btn primary small" type="submit">${icon('plus','s')} Ajouter</button><p class="note rule-match-hint" aria-live="polite">${esc(ruleMatchHint('text_exclude','any'))}</p></form>
    <p class="note space-top">Pour le niveau Bac+3 : choisis « Niveau d’études maximum requis » et saisis <strong>3</strong>. Les mentions explicites Bac+4, Bac+5, M1 et M2 seront exclues. Les annonces ambiguës demandent une vérification humaine.</p>
  </section><section class="card space-top"><div class="card-header"><h3>Niveau non indiqué</h3>${icon('shield')}</div><p class="lead">Certains sites ne précisent pas le diplôme exigé. Tu décides de les afficher ou non.</p><form id="rules-options-form" class="rule-options space-top"><label class="hint-check"><input type="checkbox" name="autoEducationLimit" ${ui.state.settings.autoEducationLimit!==false?'checked':''}/> <strong>Exclure automatiquement les offres exigeant un niveau supérieur au mien</strong> (recommandé)</label><p class="note">Si ton profil indique Bac+3, les offres explicitement réservées aux Bac+4 et Bac+5 sont exclues même si une ancienne règle manuelle est désactivée.</p><label class="hint-check"><input type="checkbox" name="strictCareer" ${ui.state.settings.strictCareer!==false?'checked':''}/> <strong>Masquer les métiers sans lien avec mon CV et ma formation</strong> (recommandé)</label><p class="note">Ex. un développeur web ne verra plus les postes d'assistant RH ou de commercial. Désactive cette option uniquement si tu veux explorer d'autres métiers.</p><label class="hint-check"><input type="checkbox" name="excludeUnknownEducation" ${ui.state.settings.excludeUnknownEducation?'checked':''}/> Exclure également les annonces sans niveau détectable</label><button class="btn small" type="submit">Sauvegarder</button></form></section>`;
}
function geoSearchForm(){
 const settings=ui.state.settings;
 if(ui.geoDraft===null)ui.geoDraft=(settings.searchZones||[]).map(zone=>({city:String(zone.city||''),radiusKm:Number(zone.radiusKm??30)}));
 const sectors=ui.state.sectors||[{id:'all',label:'Tous les secteurs'}];
 return `<details class="card geo-search-card" ${ui.page==='monitor'||ui.geoExpanded?'open':''}><summary class="advanced-summary"><strong>Zones géographiques et secteur d’activité</strong> · Personnaliser la recherche</summary>
 <form id="geo-search-form" class="space-top">
 <div class="geo-zones-head"><div><h3>Où veux-tu travailler ?</h3><p class="note">Ajoute jusqu’à 12 villes. Chaque ville dispose de son propre rayon de recherche.</p></div><span class="tag" id="geo-zone-count">${ui.geoDraft.length} / 12</span></div>
 <div class="geo-zones" id="geo-zones">${ui.geoDraft.length?ui.geoDraft.map((zone,i)=>`<div class="geo-zone" data-index="${i}"><div class="geo-zone-main"><div class="field"><label for="geo-city-${i}">Ville ${i+1}</label><input type="text" id="geo-city-${i}" class="geo-city" value="${esc(zone.city)}" maxlength="75" placeholder="Ex. Paris, Melun, Évry-Courcouronnes…" required autocomplete="address-level2" /></div><button type="button" class="icon-button geo-remove" data-action="geo-remove" data-index="${i}" aria-label="Supprimer la ville ${i+1}" title="Supprimer cette ville">${icon('trash')}</button></div><div class="geo-radius-head"><label for="geo-radius-${i}">Rayon autour de la ville</label><output for="geo-radius-${i}" id="geo-radius-label-${i}">${zone.radiusKm} km</output></div><input class="geo-radius" type="range" id="geo-radius-${i}" min="0" max="100" step="5" value="${zone.radiusKm}" aria-label="Rayon autour de ${esc(zone.city||`ville ${i+1}`)} en kilomètres" /><div class="geo-radius-scale"><span>0 km</span><span>50 km</span><span>100 km</span></div></div>`).join(''):'<p class="note geo-empty">Aucune ville définie : la recherche n’est pas limitée géographiquement.</p>'}</div>
 <div class="inline-actions space-top"><button type="button" class="btn geo-add" data-action="geo-add" ${ui.geoDraft.length>=12?'disabled':''}>${icon('plus','s')} Ajouter une ville</button><span class="note">Tu peux supprimer une ville sans perdre les autres.</span></div>
 <div class="field space-top geo-sector"><label for="search-sector">Secteur d’activité / famille de métiers</label><select id="search-sector" name="sector">${sectors.map(item=>`<option value="${esc(item.id)}" ${settings.sector===item.id?'selected':''}>${esc(item.label)}</option>`).join('')}</select></div>
 <p class="note space-top">Les rayons sont transmis aux API compatibles (France Travail et Adzuna). Les autres flux peuvent ne pas proposer de filtre kilométrique exact. Les changements prennent effet après sauvegarde et nouveau scan.</p>
 <button type="submit" class="btn primary space-top">${icon('check','s')} Enregistrer les villes et le secteur</button>
 </form></details>`;
}
function monitorPage(){
 const {settings,boards,monitoring}=ui.state;
 const last=monitoring?.lastResult;
 return `${pageHeader('AUTOMATISATION LOCALE','Surveillance & Telegram','Laisse ton ordinateur allumé : AlterRADAR surveille les stages et/ou alternances encore disponibles, selon ton choix, puis applique tes filtres.')}<div class="alert">${icon('info')}<span>Ce mode cherche et notifie automatiquement. Il prépare les dossiers avec Ollama et peut envoyer les CV et lettres sur Telegram avec <strong>validation explicite</strong>. Après approbation, un brouillon e-mail avec deux pièces jointes est généré ; si tu le choisis, un envoi SMTP peut être tenté pour une adresse de recrutement vérifiée. Les formulaires ATS restent manuels. Les annonces provenant d’écoles privées peuvent être exclues.</span></div>
 <section class="card space-top"><div class="card-header"><div><h3>Surveillance en continu</h3><p class="subtitle">Gratuite, exécutée sur ton ordinateur. Connexion Internet requise.</p></div><span class="tag ${settings.monitoringEnabled?'good':'warn'}">${settings.monitoringEnabled?'Activée':'Désactivée'}</span></div>
 <form id="monitor-form"><div class="form-grid"><div class="field"><label>Fréquence des recherches</label><select name="intervalMinutes">${[5,10,15,30,60,120,240,720,1440].map(n=>`<option value="${n}" ${Number(settings.intervalMinutes)===n?'selected':''}>${n<60?`${n} minutes${n===5?' · conseillé':''}`:n<1440?`${n/60} heure(s)`:'24 heures'}</option>`).join('')}</select><small>AlterRADAR relance la recherche selon cette fréquence, même sans rafraîchir l’écran. Chaque API garde son propre délai pour respecter ses quotas ; consulte les sources interrogées ci-dessous.</small></div></div>
 <div class="form-grid space-top"><div class="field"><label>Alertes maximum par scan</label><select name="maxNotificationsPerScan">${[3,6,12,20,30,50].map(n=>`<option value="${n}" ${Number(settings.maxNotificationsPerScan||12)===n?'selected':''}>${n} dossiers</option>`).join('')}</select></div><div class="field"><label>Après validation Telegram</label><select name="deliveryMode"><option value="draft" ${settings.deliveryMode!=='auto'?'selected':''}>Brouillon .eml, envoi manuel (recommandé)</option><option value="auto" ${settings.deliveryMode==='auto'?'selected':''}>Envoi SMTP si disponible ; sinon brouillon</option></select></div></div>
 <div class="space-top">${contractCheckboxes(settings)}</div><div class="space-top check-stack"><label class="hint-check"><input name="excludePrivateSchools" type="checkbox" ${settings.excludePrivateSchools!==false?'checked':''}/> Masquer les annonces publiées par des écoles privées et organismes de formation</label><label class="hint-check"><input name="monitoringEnabled" type="checkbox" ${settings.monitoringEnabled?'checked':''}/> Activer la surveillance en arrière-plan</label><label class="hint-check"><input name="autoStart" type="checkbox" ${settings.autoStart?'checked':''}/> Démarrer AlterRADAR à l’ouverture de ma session</label><label class="hint-check"><input name="autoPrepare" type="checkbox" ${settings.autoPrepare?'checked':''}/> Préparer automatiquement les CV et lettres (selon la limite d’alertes choisie)</label><label class="hint-check"><input name="telegramApprovalsEnabled" type="checkbox" ${settings.telegramApprovalsEnabled?'checked':''}/> Autoriser l’envoi des documents et leur validation depuis mon chat Telegram privé</label></div>
 <div class="inline-actions space-top"><button class="btn primary" type="submit">${icon('check','s')} Enregistrer</button><button type="button" data-action="scan-now" class="btn">${icon('refresh','s')} Lancer un scan maintenant</button></div></form>
 <div class="rule"></div><div class="info-line">${icon('clock','s')} Dernier scan : ${monitoring?.lastScanAt?esc(new Date(monitoring.lastScanAt).toLocaleString('fr-FR')):'Jamais'}</div><div class="info-line">${icon('briefcase','s')} ${last?`${last.scanned} source(s) réellement interrogée(s) · ${last.imported} nouvelle(s) offre(s) · ${last.notified} alerte(s)`:'Aucun résultat pour le moment'}</div>${last?.errors?.length?`<div class="alert error space-top">${esc(last.errors.slice(0,3).join(' | '))}</div>`:''}</section>
 ${geoSearchForm()}
 <section class="card space-top source-diagnostics"><div class="card-header"><div><h3>Diagnostic des sources et des filtres</h3><p class="subtitle">Ce qui a été interrogé, reçu, conservé ou écarté lors du dernier scan.</p></div><span class="tag">${(monitoring?.sourceResults||[]).length} sources interrogées ou différées</span></div>
 <div class="source-grid">${(monitoring?.sourceResults||[]).length?(monitoring.sourceResults.map(src=>{const def=(ui.state.sources||[]).find(x=>x.id===src.id);return `<div class="source-item"><strong>${esc(def?.name||src.id)}</strong><span class="tag ${src.status==='ok'?'good':src.status==='error'?'warn':''}">${src.status==='ok'?'API répond':src.status==='error'?'Erreur API':'En cache'}</span><small>${Number(src.count||0)} annonces reçues · ${src.eligible??'—'} compatibles · ${src.excluded??'—'} exclues</small>${src.reason?`<small class="source-error">${esc(src.reason)}</small>`:''}${(src.warnings||[]).map(x=>`<small class="source-error">${esc(x)}</small>`).join('')}</div>`;}).join('')):'<p class="note">Aucun scan enregistré. Lance « Chercher maintenant » pour collecter un diagnostic.</p>'}</div>
 <p class="note space-top">11 connecteurs sont programmés, dont 7 sans clé personnelle. La bonne alternance utilise également le relais s’il est configuré. Certains ne publient presque pas d’alternances françaises. Les demandes en cache conservent ici les compteurs du dernier passage réussi.</p>
 <div class="rule"></div><h4>Extension des tableaux de recrutement ATS</h4>
 ${(monitoring?.atsResults||[]).length?`<div class="source-grid space-top">${monitoring.atsResults.map(b=>`<div class="source-item"><strong>${esc(b.id)}</strong><span class="tag ${b.status==='ok'?'good':'warn'}">${b.status==='ok'?'Connecteur interrogé':'Erreur API'}</span><small>${b.count||0} offres lues</small>${b.reason?`<small class="source-error">${esc(b.reason)}</small>`:''}</div>`).join('')}</div>`:'<p class="note">Aucun tableau public ATS n’a été découvert parmi les liens reçus au dernier scan. C’est normal : la détection de 30 logiciels ne lance pas 30 explorations.</p>'}
 <p class="note space-top">30 ATS sont reconnaissables par leurs URL, mais seuls 9 ont une exploration publique programmée. Aucun scraping de formulaires de candidature privés n’est effectué.</p></section>
 <section class="card space-top"><div class="card-header"><div><h3>Sources automatiques</h3><p class="subtitle">Aucune URL à saisir. Les flux gratuits démarrent automatiquement. Réglages avancés facultatifs.</p></div><span class="tag">${(settings.sourceEnabled||[]).length} activées</span></div>
 <p class="note">Les sources publiques sont consultées sans lien à saisir. Le flux communautaire français est limité à la tech et peut être incomplet. Les clés France Travail et Adzuna sont facultatives mais vivement recommandées en France. La bonne alternance fonctionne sans clé personnelle après déploiement du relais officiel AlterRADAR ; en attendant tu peux utiliser ta clé personnelle. Les API possèdent des limites, donc l’application ne peut pas garantir toutes les annonces du Web.</p>
 <details class="space-top"><summary class="advanced-summary">Options avancées · Activer des sources supplémentaires</summary><form id="sources-form" class="space-top"><div class="source-grid">${(ui.state.sources||[]).map(source=>{
   const status=(monitoring?.sourceResults||[]).find(x=>x.id===source.id);
   const enabled=(settings.sourceEnabled||[]).includes(source.id);
   return `<div class="source-item"><label class="hint-check"><input type="checkbox" name="source" value="${esc(source.id)}" ${enabled?'checked':''} /><strong>${esc(source.name)}</strong></label><small>${esc(source.region)} · ${esc(source.note)}</small><div class="inline-actions space-top"><span class="tag ${status?.status==='ok'?'good':status?.status==='error'?'warn':''}">${status?.status==='ok'?`${status.count} lues · ${status.eligible??'?'} compatibles · ${status.excluded??'?'} écartées`:status?.status==='error'?'Erreur API':status?.status==='skipped'?'Actualisation différée (cache)':'Pas encore interrogée'}</span>${source.auth!=='none'?`<span class="tag ${settings.sourceCredentialStatus?.[source.id]?'good':'warn'}">${settings.sourceCredentialStatus?.[source.id]?'Clé enregistrée':source.id==='labonnealternance'&&ui.state.relayAvailable?'Relais commun actif':'Clé personnelle requise'}</span>`:''}</div>${status?.reason?`<small>${esc(status.reason)}</small>`:''}${(status?.warnings||[]).map(w=>`<small>${esc(w)}</small>`).join('')}</div>`;}).join('')}</div><button class="btn primary small space-top" type="submit">${icon('check','s')} Enregistrer les sources</button></form>
 <div class="rule"></div><details class="ats-disclosure"><summary>Détection des ATS (30 plateformes) · Afficher la couverture</summary><p class="note">Les URL des annonces sont analysées automatiquement. Quand une annonce pointe vers un tableau public reconnu, AlterRADAR peut aussi chercher les autres postes de cet employeur (6 tableaux maximum par scan, actualisation limitée). Être reconnu ne garantit pas qu’une API publique ou une candidature automatique soit disponible.</p><div class="source-grid space-top">${(ui.state.atsCatalog||[]).map(ats=>`<div class="source-item"><strong>${esc(ats.name)}</strong><div class="inline-actions space-top"><span class="tag ${ats.discovery==='public-api'?'good':''}">${ats.discovery==='public-api'?'Connecteur public (à vérifier)':'Reconnaissance URL'}</span></div></div>`).join('')}</div></details>
 <div class="rule"></div><h3>Configurer les API avec identifiants</h3><p class="note">Ces identifiants sont facultatifs et chiffrés dans le coffre macOS/Windows. Ils ne sont pas intégrés au code source ni visibles dans l’interface après sauvegarde.</p>
 ${(ui.state.sources||[]).filter(src=>src.auth!=='none').map(src=>`<form class="source-credential-form space-top" data-id="${esc(src.id)}"><strong>${esc(src.name)}</strong><div class="form-grid space-top">${src.id==='francetravail'?`<div class="field"><label>Identifiant client</label><input name="clientId" autocomplete="off" required /></div><div class="field"><label>Secret client</label><input type="password" name="clientSecret" autocomplete="new-password" required /></div><div class="field full"><label>Portée OAuth (optionnelle)</label><input name="scope" placeholder="api_offresdemploiv2 o2dsoffre" /></div>`:src.id==='adzuna'?`<div class="field"><label>App ID</label><input name="appId" autocomplete="off" required /></div><div class="field"><label>App Key</label><input type="password" name="appKey" autocomplete="new-password" required /></div>`:`<div class="field full"><label>Clé API</label><input type="password" name="apiKey" autocomplete="new-password" required /></div>`}</div><div class="inline-actions space-top"><button type="submit" class="btn small">${icon('check','s')} Enregistrer la clé</button>${settings.sourceCredentialStatus?.[src.id]?`<button type="button" class="btn small ghost" data-action="source-clear" data-id="${esc(src.id)}">Supprimer la clé</button>`:''}</div></form>`).join('')}
 </details></section><div class="two-cols space-top">
 <section class="card"><div class="card-header"><h3>Connecter mon bot Telegram</h3>${icon('send')}</div><p class="lead">Chaque utilisateur connecte <strong>son propre bot Telegram gratuit</strong>. Il n’y a aucun bot AlterRADAR central ni serveur du créateur recevant tes documents.</p>
 <div class="step-list space-top"><div class="step"><span class="step-num">1</span><div><strong>Créer ton bot avec @BotFather</strong><p>Ouvre BotFather dans Telegram, lance /newbot et copie le jeton secret. Ne le partage jamais.</p></div></div><div class="step"><span class="step-num">2</span><div><strong>Enregistrer le jeton ci-dessous</strong><p>Il reste dans le coffre de ton ordinateur. Un nouveau jeton déconnecte automatiquement l’ancien chat.</p></div></div><div class="step"><span class="step-num">3</span><div><strong>Saisir la clé générée dans ton bot</strong><p>Copie la clé depuis AlterRADAR, puis colle-la dans le chat privé de ton bot. Pas besoin de Chat ID. La clé expire après 10 minutes.</p></div></div></div>
 <div class="telegram-health-panel space-top"><div class="telegram-health-heading"><strong>Diagnostic Telegram</strong><span class="tag ${ui.telegramHealth?.ready?'good':'warn'}">${ui.telegramHealth?.ready?'Bot et chat vérifiés':'Non vérifié'}</span></div><p class="note">La vérification contrôle le jeton et le chat privé, sans envoyer de message ni de document. « Envoyer un test » envoie ensuite un message uniquement sur ton clic.</p><div class="inline-actions space-top"><button type="button" class="btn small" data-action="telegram-check" ${!settings.telegramConfigured?'disabled':''}>${icon('check','s')} Vérifier ma connexion</button></div>${ui.telegramHealth?`<div class="telegram-check-results" role="status"><strong>${esc(ui.telegramHealth.botName)}</strong><p>${esc(ui.telegramHealth.message)}</p><p>Alertes automatiques : <strong>${ui.telegramHealth.monitoringEnabled?'activées':'désactivées'}</strong> · Validation de dossiers : <strong>${ui.telegramHealth.approvalsEnabled?'activée':'désactivée'}</strong></p></div>`:''}</div>
 <div class="inline-actions space-top"><button type="button" class="btn small" data-action="open-botfather">${icon('up-right','s')} Ouvrir BotFather</button><span class="tag ${settings.telegramChatId?'good':'warn'}">${settings.telegramChatId?'Chat privé connecté':'Chat non connecté'}</span></div>
 <form id="telegram-form"><div class="field space-top"><label>Chat ID (détecté automatiquement)</label><input name="chatId" readonly value="${esc(settings.telegramChatId||'')}" placeholder="Associe d’abord ton compte depuis le lien ci-dessous" /></div><div class="field space-top"><label>Jeton du bot Telegram ${settings.telegramConfigured?'· Enregistré localement':''}</label><input name="token" type="password" autocomplete="new-password" placeholder="${settings.telegramConfigured?'Laisser vide pour conserver le jeton':'123456789:AA…'}" /></div><div class="space-top"><label class="hint-check"><input type="checkbox" name="clearToken"/> Effacer le jeton enregistré</label></div><div class="inline-actions space-top"><button class="btn primary small" type="submit">${icon('check','s')} Enregistrer</button><button type="button" class="btn small" data-action="telegram-pair">${icon('check','s')} Générer le lien de liaison</button><button type="button" class="btn small" data-action="telegram-test">${icon('send','s')} Envoyer un test</button></div></form>
 ${ui.telegramPairing && !settings.telegramChatId ? `<div class="alert space-top"><span><strong>Clé de liaison personnelle (10 min) :</strong><div class="pair-code">${esc(ui.telegramPairing.code)}</div><div class="inline-actions space-top"><button class="btn small primary" data-action="telegram-copy-pair">${icon('check','s')} Copier la clé</button><button class="btn small" data-action="telegram-open-pair">${icon('up-right','s')} Ouvrir mon bot</button></div><p class="note space-top">Dans le chat privé de ton bot, colle uniquement la clé, ou envoie <strong>/connect ${esc(ui.telegramPairing.code)}</strong>. L’association est vérifiée par ton PC.</p></span></div>`:''}
 <p class="note space-top">Telegram est une plateforme externe : le titre et le lien des offres lui sont envoyés. Lorsque tu actives la validation Telegram, le CV et la lettre adaptés sont transmis aux serveurs Telegram, avec des boutons Valider / À corriger. Les documents d’origine restent locaux. Utilise un chat privé avec ton bot. Le jeton est chiffré via le coffre du système.</p>${ui.state.runtime?.lastTelegramError?`<div class="alert error space-top">${icon('info')}<span>Dernière erreur Telegram : ${esc(ui.state.runtime.lastTelegramError)}</span></div>`:''}</section></div>
 <section class="card space-top"><div class="card-header"><div><h3>Envoi automatique par e-mail, après validation</h3><p class="subtitle">Optionnel · utilise ton propre SMTP (sans serveur AlterRADAR).</p></div>${icon('send')}</div>
 <p class="lead">Après validation Telegram, AlterRADAR peut joindre les deux DOCX à un e-mail <strong>seulement si tu renseignes une adresse de candidature dans l’offre</strong>. Aucun formulaire de site tiers n’est contourné. Un mot de passe d’application SMTP peut être nécessaire selon ton fournisseur.</p>
 <form id="smtp-form" class="space-top"><div class="form-grid"><div class="field"><label>Serveur SMTP</label><input name="smtpHost" value="${esc(settings.smtpHost||'')}" placeholder="smtp.gmail.com" /></div><div class="field"><label>Port chiffré</label><select name="smtpPort"><option value="587" ${Number(settings.smtpPort)===587?'selected':''}>587 · STARTTLS</option><option value="465" ${Number(settings.smtpPort)===465?'selected':''}>465 · TLS</option></select></div><div class="field"><label>Identifiant SMTP</label><input name="smtpUser" autocomplete="off" value="${esc(settings.smtpUser||'')}" placeholder="compte@exemple.fr" /></div><div class="field"><label>E-mail expéditeur</label><input type="email" name="smtpFrom" value="${esc(settings.smtpFrom||'')}" placeholder="compte@exemple.fr" /></div><div class="field full"><label>Mot de passe SMTP ${settings.smtpConfigured?'· enregistré dans le coffre système':''}</label><input name="password" type="password" autocomplete="new-password" placeholder="Laisser vide pour conserver le mot de passe" /></div></div><label class="hint-check space-top"><input type="checkbox" name="clearPassword"/> Effacer le mot de passe SMTP</label><div class="inline-actions space-top"><button class="btn primary small" type="submit">${icon('check','s')} Enregistrer SMTP</button></div></form>
 <p class="note space-top">La validation d’un dossier reste obligatoire. Un envoi marqué « en attente de réponse » signifie que le serveur SMTP l’a accepté, sans garantir la livraison à l’entreprise. En cas d’erreur, AlterRADAR conserve la preuve et ne réessaie pas silencieusement.</p></section>
 <p class="note space-top">Pour fonctionner une semaine : laisse l’app active (elle reste dans la zone de notification si la surveillance est activée), le PC connecté à Internet et la veille automatique désactivée. Il ne s’agit pas d’un service cloud : si le PC est éteint ou en veille, les scans s’arrêtent.</p>`;
}
function settings(){
  const system=ui.system||{},list=ui.models.models,reco=system.recommended;
  const selected=ui.state.settings.selectedModel;
  const connected=ui.models.connected;
  const selectedValid=list.some(x=>x.name===selected);
  return `${pageHeader('PRÉFÉRENCES','Paramètres','Ton espace, ton ordinateur, ton modèle d’intelligence artificielle.')}
    <section class="card space-top source-visibility-settings" id="offer-visibility-settings"><div class="card-header"><div><h2>Affichage et sources des annonces</h2><p class="subtitle">Choisis les organismes de formation et la source française La bonne alternance, indépendamment.</p></div>${icon('filter')}</div>
    <form id="visibility-form" class="check-stack space-top">
      <label class="hint-check"><input type="checkbox" name="showTrainingListings" ${ui.state.settings.excludePrivateSchools===false?'checked':''}/> <strong>Afficher aussi les annonces des écoles privées et organismes de formation</strong></label>
      <p class="note">Désactivé par défaut. Ce filtre est indicatif : la reconnaissance des organismes n’est pas exhaustive. Il ne désactive pas les offres d’entreprises trouvées sur La bonne alternance.</p>
      <label class="hint-check"><input type="checkbox" name="enableLba" ${(ui.state.settings.sourceEnabled||[]).includes('labonnealternance')?'checked':''}/> <strong>Activer les offres La bonne alternance</strong></label>
      <p class="note">${(ui.state.settings.sourceEnabled||[]).includes('labonnealternance')?'Source sélectionnée.':'Source désactivée.'} ${ui.state.relayAvailable?'Relais configuré.':ui.state.settings.sourceCredentialStatus?.labonnealternance?'Clé personnelle enregistrée.':'Une clé API personnelle ou un relais AlterRADAR déployé est nécessaire pour obtenir des résultats. Activer la case ne suffit pas sans accès API.'}</p>
      <div class="inline-actions space-top"><button type="submit" class="btn primary small">${icon('check','s')} Enregistrer et actualiser l’affichage</button><button type="button" class="btn small" data-nav="monitor">Diagnostic des sources ${icon('arrow','s')}</button></div>
    </form></section>
    <section class="card"><div class="card-header"><div><h2>Modèle IA local</h2><div class="subtitle">Choisis un modèle déjà installé dans Ollama.</div></div><span class="tag ${connected?'good':'warn'}">${connected?`${icon('check','s')} Ollama connecté`:'Ollama hors ligne'}</span></div>
    <div class="metric-row"><div class="metric"><small>RAM totale</small><strong>${esc(system.totalGb??'—')} Go</strong><small>${esc(system.freeGb??'—')} Go libres selon le système</small></div><div class="metric"><small>Modèle conseillé</small><strong style="font-size:16px;margin:5px 0">${esc(reco||'IA locale déconseillée')}</strong><small>Estimation selon la mémoire disponible</small></div></div>
    <div class="settings-row"><div class="settings-label"><strong>Modèle utilisé par AlterRADAR</strong><span>Seuls les modèles réellement présents sur cette machine apparaissent ici. Ton choix est mémorisé et prioritaire.</span></div><div class="settings-control"><select id="model-selector" ${!list.length?'disabled':''}><option value="">${!connected?'Ollama indisponible':!list.length?'Aucun modèle installé':'Sélectionner un modèle'}</option>${list.map(m=>`<option value="${esc(m.name)}" ${m.name===selected?'selected':''}>${esc(m.name)} · ${gb(m.size)}</option>`).join('')}</select></div></div>
    <div class="settings-row"><div class="settings-label"><strong>Modèles détectés</strong><span>${list.length} modèle(s) trouvé(s). Leur taille correspond à l’espace disque, pas à l’utilisation exacte de RAM.</span></div><button class="btn small" data-action="refresh-models">${icon('refresh','s')} Actualiser</button></div>
    ${selected && !selectedValid && connected ? `<div class="alert error">${icon('info')} Le modèle précédemment choisi (${esc(selected)}) n’est plus installé. Sélectionne un modèle de la liste.</div>`:''}
    ${list.length?`<div class="model-list">${list.map(m=>`<div class="model-option ${selected===m.name?'active':''}"><div><strong>${esc(m.name)} ${m.name===reco?'<span class="tag good" style="margin-left:7px">Recommandé</span>':''}</strong><small>${gb(m.size)} sur le disque · ${esc(m.parameters||m.family||'Paramètres non indiqués')} ${m.quantization?`· ${esc(m.quantization)}`:''}</small></div>${selected===m.name?`<span class="tag good">${icon('check','s')} Actif</span>`:`<button data-action="choose-model" data-model="${esc(m.name)}">Utiliser</button>`}</div>`).join('')}</div>`:empty('cpu','Aucun modèle disponible',connected?'Télécharge un modèle avec Ollama puis actualise la liste.':'Démarre Ollama pour détecter les modèles installés.')}
    </section>
    <div class="two-cols" style="margin-top:20px"><section class="card"><div class="card-header"><h3>Installer un nouveau modèle</h3>${icon('download')}</div><p class="lead" style="font-size:12px">Ollama est un moteur IA séparé. Il doit être installé et lancé sur ce PC ou Mac.</p><div class="step-list space-top"><div class="step"><span class="step-num">1</span><div><strong>Installer et lancer Ollama</strong><p>Disponible sur Windows et macOS. Pas de compte obligatoire.</p></div></div><div class="step"><span class="step-num">2</span><div><strong>Télécharger le modèle conseillé</strong><p>Utilise le bouton « Installer Qwen recommandé en 1 clic » ci-dessous. En cas de difficulté, commande de secours :</p><div class="codepill" style="margin-top:8px">${esc(reco?`ollama pull ${reco}`:'ollama pull qwen2.5:1.5b')}</div></div></div><div class="step"><span class="step-num">3</span><div><strong>Actualiser la liste</strong><p>Choisis ensuite le modèle téléchargé, ou n’importe quel modèle déjà installé.</p></div></div></div><div class="inline-actions space-top"><button class="btn primary" data-action="install-qwen" ${!reco||!connected||ui.busy||ui.modelProgress?.active?'disabled':''}>${icon('download','s')} ${list.some(m=>m.name===reco)?'Sélectionner Qwen recommandé':'Installer Qwen recommandé en 1 clic'}</button><button class="btn" data-action="open-model-library">Voir les modèles Qwen ${icon('up-right','s')}</button><button class="btn" data-action="get-ollama">Site Ollama ${icon('up-right','s')}</button><button class="btn" data-action="refresh-models">Actualiser ${icon('refresh','s')}</button></div><div id="model-pull-inline" class="space-top">${modelPullMarkup()}</div><div class="model-market space-top"><h4>Bibliothèque Qwen · Installation locale</h4><p class="note">Sélectionne le modèle qui te convient. Les modèles nécessitant davantage de RAM restent disponibles, mais affichent un avertissement.</p><div class="model-market-grid">${ui.modelCatalog.map(model=>`<div class="model-market-item"><div><strong>${esc(model.label)}</strong><small>${esc(model.note)} · RAM conseillée : ${model.minRam} Go${Number(ui.system?.totalGb||0)<model.minRam?' · RAM probablement insuffisante':''}</small></div><button class="btn small" data-action="install-catalog-model" data-model="${esc(model.name)}" ${!connected||ui.busy||ui.modelProgress?.active?'disabled':''}>${list.some(x=>x.name===model.name)?'Choisir':'Installer'}</button></div>`).join('')}</div></div><p class="note space-top">Le téléchargement est gratuit mais nécessite Internet et plusieurs Go de disque. Il ne démarre qu'après ton clic. Une recommandation basée sur la RAM totale n'est pas une garantie de mémoire disponible au moment de la génération.</p></section>
    <section class="card"><div class="card-header"><h3>Confidentialité</h3>${icon('shield')}</div><div class="info-line">${icon('shield','s')} Documents enregistrés dans les données locales de l’app</div><div class="info-line">${icon('cpu','s')} Inférence envoyée uniquement à Ollama sur 127.0.0.1</div><div class="info-line">${icon('search','s')} Internet pour offres, Telegram et SMTP si activés</div><div class="info-line">${icon('check','s')} Aucun envoi de candidature sans validation</div><p class="note space-top">La détection de RAM est indicative. Un gros modèle peut manquer de mémoire, même si son téléchargement est possible. Les scores ne sont pas des probabilités de recrutement.</p></section></div>
    <section class="card space-top appearance-settings"><div class="card-header"><div><h2>Apparence personnalisée</h2><p class="subtitle">Un fond local, une interface sobre ou un verre dépoli teinté. Les réglages sont enregistrés sur ce PC.</p></div>${icon('sparkles')}</div>
      <div class="appearance-presets" role="group" aria-label="Choisir un thème visuel">
        <button type="button" class="appearance-preset ${ui.state.settings.theme==='light'?'active':''}" data-action="theme-preset" data-theme-name="light" aria-pressed="${ui.state.settings.theme==='light'}"><span class="preset-visual preset-light"><span></span><i></i><b></b></span><span class="preset-caption"><strong>Pure White</strong><small>Blanc & noir · par défaut</small></span></button>
        <button type="button" class="appearance-preset ${ui.state.settings.theme==='dark'?'active':''}" data-action="theme-preset" data-theme-name="dark" aria-pressed="${ui.state.settings.theme==='dark'}"><span class="preset-visual preset-night"><span></span><i></i><b></b></span><span class="preset-caption"><strong>Twilight Purple</strong><small>Noir profond · violet</small></span></button>
        <button type="button" class="appearance-preset ${ui.state.settings.theme==='apple'?'active':''}" data-action="theme-preset" data-theme-name="apple" aria-pressed="${ui.state.settings.theme==='apple'}"><span class="preset-visual preset-frost"><span></span><i></i><b></b></span><span class="preset-caption"><strong>Frosted Glass</strong><small>Clair · verre doux</small></span></button>
      </div>
      <div class="appearance-grid">
        <div class="field"><label for="theme-selector">Thème</label><select id="theme-selector"><option value="dark" ${ui.state.settings.theme==='dark'?'selected':''}>Sombre · anthracite & Twilight Purple</option><option value="light" ${ui.state.settings.theme==='light'?'selected':''}>Clair · noir & blanc</option><option value="apple" ${ui.state.settings.theme==='apple'?'selected':''}>Apple Light · verre monochrome</option><option value="system" ${ui.state.settings.theme==='system'?'selected':''}>Suivre le système</option></select></div>
        <div class="field"><label for="appearance-style">Effet des panneaux</label><select id="appearance-style"><option value="solid" ${ui.state.settings.appearanceStyle==='solid'?'selected':''}>Classique · opaque</option><option value="glass" ${ui.state.settings.appearanceStyle==='glass'?'selected':''}>Liquid Glass · translucide</option><option value="tinted" ${ui.state.settings.appearanceStyle==='tinted'?'selected':''}>Liquid Glass · teinté</option></select></div>
        <div class="field"><label for="wallpaper-mode">Fond de l'application</label><select id="wallpaper-mode"><option value="none" ${ui.state.settings.wallpaperMode==='none'?'selected':''}>Uni · discret</option><option value="gradient" ${ui.state.settings.wallpaperMode==='gradient'?'selected':''}>Dégradé artistique</option><option value="image" ${ui.state.settings.wallpaperMode==='image'?'selected':''}>Image personnelle ${ui.wallpaperData?'(chargée)':'(à importer)'}</option></select></div>
        <div class="field glass-tint-field"><label for="glass-tint">Teinte du verre</label><div class="tint-swatches" role="group" aria-label="Couleurs prédéfinies">${[['#9b8bff','Violet'],['#77bafc','Bleu glacier'],['#e5a8c9','Rose perlé'],['#8ec9ae','Vert sauge'],['#eec89d','Sable'],['#aeb8c8','Gris']].map(([color,label])=>`<button type="button" class="tint-swatch ${String(ui.state.settings.glassTint||'').toLowerCase()===color?'selected':''}" style="--swatch:${color}" data-action="tint-select" data-color="${color}" aria-label="${label}" title="${label}" aria-pressed="${String(ui.state.settings.glassTint||'').toLowerCase()===color}"></button>`).join('')}</div><div class="color-control"><input id="glass-tint" type="color" value="${esc(ui.state.settings.glassTint||'#9b8bff')}" aria-label="Choisir une couleur personnalisée" /><input id="glass-tint-hex" type="text" inputmode="text" maxlength="7" spellcheck="false" value="${esc(ui.state.settings.glassTint||'#9b8bff')}" aria-label="Code couleur hexadécimal" pattern="#[a-fA-F0-9]{6}" placeholder="#9B8BFF" /></div><small>Choisis une pastille ou saisis une couleur hexadécimale.</small></div>
        <div class="field"><label for="glass-intensity">Intensité du verre · <span id="intensity-label">${Number(ui.state.settings.glassIntensity??50)} %</span></label><input id="glass-intensity" type="range" min="0" max="100" step="5" value="${Number(ui.state.settings.glassIntensity??50)}" /></div>
        <div class="field"><label>Performances</label><label class="hint-check"><input id="reduce-effects" type="checkbox" ${ui.state.settings.reduceEffects?'checked':''}/> Réduire les effets visuels (fond plus discret, animations désactivées)</label></div>
      </div>
      <div class="inline-actions space-top"><button class="btn" data-action="wallpaper-pick">${icon('upload','s')} Importer une image (PNG/JPG/WebP · 32 Mo max, compression auto)</button><button class="btn ghost" data-action="wallpaper-clear">${icon('refresh','s')} Retirer l'image</button></div>
      <p class="note space-top">L'image est enregistrée dans les données locales d'AlterRADAR, jamais dans le dépôt Git ni sur un serveur. L'effet reste facultatif pour privilégier la lisibilité.</p>
    </section>
    <section class="card space-top about-alterradar"><div class="card-header"><h3>À propos d’AlterRADAR</h3>${icon('info')}</div>
 <p class="lead"><strong>AlterRADAR</strong> · Version ${esc(ui.state.version||'0.14.0')} · Application gratuite et open source pour Windows et macOS.</p>
 <p class="creator-about">Créé et développé par <strong>Akasche MAHINTAN</strong>.</p>
 <div class="about-points space-top"><div class="about-point"><strong>${icon('shield','s')} Tes données restent sur ton ordinateur par défaut.</strong><p>Ton profil, tes documents, tes règles de tri, tes candidatures et ton historique sont conservés localement. Les modèles Ollama génèrent tes documents sur ton propre PC. AlterRADAR ne possède pas de serveur central de comptes, de CV ou de télémétrie.</p></div>
 <div class="about-point"><strong>${icon('user','s')} Le créateur n’a pas accès à tes données personnelles.</strong><p>Akasche MAHINTAN ne reçoit pas les fichiers enregistrés sur ton appareil et ne peut pas consulter ton dossier depuis AlterRADAR. Attention : tes fichiers locaux ne sont pas chiffrés au repos ; protège ta session.</p></div>
 <div class="about-point"><strong>${icon('send','s')} Tu contrôles les envois externes.</strong><p>Quand tu actives Telegram, les alertes et éventuellement le CV/lettre sont envoyés aux serveurs Telegram ; quand tu postes par e-mail, ils passent par ton fournisseur e-mail et le recruteur. Les recherches d’offres contactent les plateformes d’emploi. Ces tiers appliquent leurs propres règles de confidentialité.</p></div>
 <div class="about-point"><strong>${icon('check','s')} Gratuit à télécharger et à utiliser.</strong><p>Sans abonnement, sans clé d’IA payante, sous licence MIT. Le code source et les installateurs Windows et macOS sont publiés sur le dépôt GitHub AkshiiGIT/AlterRADAR (page Releases). Ollama et un modèle compatible sont nécessaires pour la génération IA ; Internet et électricité restent à ta charge.</p></div></div>
 <div class="rule"></div><h3>Contacter le créateur</h3><div class="inline-actions space-top"><button class="btn" data-action="open-repository">${icon('up-right','s')} GitHub · AkshiiGIT/AlterRADAR</button>${ui.state.creator?.linkedinUrl?`<button class="btn" data-action="open-creator-linkedin">${icon('up-right','s')} LinkedIn · Akasche MAHINTAN</button>`:`<span class="note">LinkedIn : lien du profil à compléter avant la publication.</span>`}<button class="btn" data-action="open-creator-email">${icon('send','s')} ${esc(ui.state.creator?.email||'Contacter le créateur')}</button></div>
 <p class="note space-top">© 2026 Akasche MAHINTAN · Licence MIT. Les messages Telegram ne sont pas des conversations secrètes chiffrées de bout en bout.</p></section>`;
}
function applyAppearance(){
  const settings=ui.state?.settings||{};
  document.body.dataset.appearance=settings.appearanceStyle||'solid';
  document.body.dataset.wallpaper=settings.wallpaperMode||'none';
  document.body.dataset.appleGlass=settings.theme==='apple'?'true':'false';
  document.body.dataset.reduceEffects=settings.reduceEffects?'true':'false';
  const hex=/^#[0-9a-f]{6}$/i.test(settings.glassTint||'')?settings.glassTint:'#9b8bff';
  document.documentElement.style.setProperty('--ar-tint-rgb',[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', '));
  document.documentElement.style.setProperty('--ar-glass-alpha',String(.04+Number(settings.glassIntensity??50)/100*.20));
  document.documentElement.style.setProperty('--ar-glass-blur',settings.reduceEffects?'0px':`${Math.round(10+Number(settings.glassIntensity??50)*.25)}px`);
  const safeData=typeof ui.wallpaperData==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(ui.wallpaperData)?ui.wallpaperData:'';
  document.documentElement.style.setProperty('--ar-wallpaper',safeData?`url("${safeData}")`:'none');
}
function render(){
  if(!ui.state) return;
  document.body.dataset.theme=ui.state.settings.theme==='apple' ? 'light' : ui.state.settings.theme==='system' ? ((window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark') : ui.state.settings.theme;
  applyAppearance();
  document.body.classList.add('ar-ready');
  // Animate only an actual page change, not every in-place data update.
  document.body.dataset.viewTransition=ui.lastRenderedPage!==ui.page?'true':'false';
  const views={onboarding,dashboard,jobs,documents,applications,rules:rulesPage,monitor:monitorPage,settings};
  // Keep the reader's position when an in-page action refreshes the view.
  // Navigation to another page starts from the top, as expected.
  const oldMain=appEl.querySelector('.main-area');
  const previousScroll=oldMain&&ui.lastRenderedPage===ui.page?oldMain.scrollTop:0;
  appEl.innerHTML=`<div class="app-shell">${sidebar()}<main class="main-area">${topbar()}${(views[ui.page]||dashboard)()}</main><div id="model-pull-dock" class="model-pull-dock" hidden></div></div>`;
  paintModelPull();
  appEl.querySelector('.main-area').scrollTop=previousScroll;
  if(ui.page==='rules')appEl.querySelectorAll('.rule-edit-form select[name="field"], #new-rule-form select[name="field"]').forEach(syncRuleMatchUI);
  ui.lastRenderedPage=ui.page;
  drawToast();
}
function distanceFingerprint(){return JSON.stringify({jobs:(ui.state?.jobs||[]).map(j=>j.id),zones:ui.state?.settings?.searchZones||[],location:ui.state?.profile?.location||''});}
async function loadState({skipUnchanged=false}={}){
  const fresh=await window.radar.state();
  // A window-focus check is not a reason to destroy the DOM when nothing changed.
  if(skipUnchanged&&ui.state&&JSON.stringify(fresh)===JSON.stringify(ui.state))return false;
  ui.state=fresh;
  if(ui.state.settings.telegramChatId)ui.telegramPairing=null;
  render();
  if(ui.page==='jobs'&&ui.state.settings.jobsSort==='distance'&&!ui.distanceLoading&&ui.distanceVersion!==distanceFingerprint())void refreshDistances();
  return true;
}
async function refreshModels(){ui.models=await window.radar.models();render();}
async function refreshDistances(){
  const token=++ui.distanceRequest;const version=distanceFingerprint();ui.distanceLoading=true;ui.distanceStatus='';render();
  try{const response=await window.radar.jobDistances();if(token!==ui.distanceRequest)return;ui.jobDistances=response.distances||{};ui.distanceStatus=response.note||'';if(response.checked)ui.distanceStatus=`${response.known}/${response.checked} offres localisées. ${ui.distanceStatus}`;}
  catch(error){if(token!==ui.distanceRequest)return;ui.jobDistances={};ui.distanceStatus='Distance indisponible : '+(error?.message||'vérifie ta connexion.');}
  finally{if(token===ui.distanceRequest){ui.distanceVersion=version;ui.distanceLoading=false;if(ui.page==='jobs')render();}}
}
async function perform(action,success){
  if(ui.busy)return;
  ui.busy=true;render();
  try {const value=await action();ui.dirty=false; await loadState();if(success)tip(success);return value;}
  catch(error){tip(error?.message||'Une erreur est survenue','error');return null;}
  finally{ui.busy=false;render();}
}
appEl.addEventListener('click',event=>{
  const summary=event.target.closest('.geo-search-card > summary');
  if(summary)ui.geoExpanded=!summary.parentElement.open;
});
appEl.addEventListener('click',async(event)=>{
  const node=event.target.closest('[data-action],[data-nav]');
  if(!node)return;
  if(node.dataset.nav){if(ui.page==='monitor'&&node.dataset.nav!=='monitor')ui.geoDraft=null;ui.geoExpanded=node.dataset.nav==='monitor';ui.page=node.dataset.nav;ui.jobId='';ui.dirty=false;render();return;}
  if(node.dataset.action==='cancel-model-pull'){
    if(ui.modelProgress?.active&&!ui.modelProgress.cancelling){ui.modelProgress.cancelling=true;paintModelPull();try{await window.radar.cancelModelPull();}catch(error){tip(error.message,'error');}}
    return;
  }
  if(node.dataset.action==='dismiss-model-pull'){
    if(!ui.modelProgress?.active){ui.modelProgress=null;paintModelPull();}
    return;
  }
  if(ui.busy)return; // Les actions sont verrouillées, mais la navigation reste disponible.
  const id=node.dataset.id,kind=node.dataset.kind,action=node.dataset.action;
  if(action==='theme'){const theme=document.body.dataset.theme==='dark'?'light':'dark';await perform(()=>window.radar.saveSettings({theme}));return;}
  if(action==='theme-preset'){
    const theme=node.dataset.themeName;
    if(['light','dark','apple'].includes(theme)) {
      // A preset describes a complete visual style; the user can still customize
      // the wallpaper and glass mode separately using the controls below.
      const changes = theme==='apple'
        ? {theme:'apple',appearanceStyle:'glass',wallpaperMode:ui.state.settings.wallpaperMode==='image'&&ui.wallpaperData?'image':'gradient'}
        : {theme,appearanceStyle:'solid',wallpaperMode:'none'};
      await perform(()=>window.radar.saveSettings(changes),'Style visuel appliqué.');
    }
    return;
  }
  if(action==='geo-add'){
    if(ui.geoDraft===null)ui.geoDraft=(ui.state.settings.searchZones||[]).map(z=>({...z}));
    if(ui.geoDraft.length>=12){tip('Maximum 12 villes.','error');return;}
    ui.geoDraft.push({city:'',radiusKm:30});ui.dirty=true;render();
    document.querySelector(`#geo-city-${ui.geoDraft.length-1}`)?.focus();return;
  }
  if(action==='geo-remove'){
    const index=Number(node.dataset.index);
    if(!Array.isArray(ui.geoDraft)||!Number.isInteger(index)||index<0||index>=ui.geoDraft.length)return;
    ui.geoDraft.splice(index,1);ui.dirty=true;render();return;
  }
  if(action==='tint-select'){
    const color=node.dataset.color;
    if(!/^#[0-9a-f]{6}$/i.test(color||''))return;
    await perform(()=>window.radar.saveSettings({glassTint:color}),'Teinte appliquée.');return;
  }
  if(action==='telegram-check'){
    if(!ui.state.settings.telegramConfigured){tip('Enregistre d’abord ton jeton BotFather.','error');return;}
    try{ui.telegramHealth=await window.radar.telegramHealth();render();tip(ui.telegramHealth.ready?'Connexion Telegram vérifiée.':'Liaison Telegram à terminer.',ui.telegramHealth.ready?'success':'error');}
    catch(error){ui.telegramHealth=null;tip(error?.message||'Diagnostic Telegram indisponible.','error');}
    return;
  }
  if(action==='all-jobs'){ui.page='jobs';render();return;}
  if(action==='select-job'){ui.page='jobs';ui.jobId=id;render();return;}
  if(action==='application-detail'){ui.page='applications';ui.jobId=id;render();return;}
  if(action==='focus-new-job'){document.getElementById('add-job')?.scrollIntoView({behavior:'smooth'});document.querySelector('#add-job-form input')?.focus();return;}
  if(action==='verify-job-date'){const result=await perform(()=>window.radar.verifyJobDate(id));if(result){const msg=result.dateCheckStatus==='verified'?'Date de publication confirmée sur le site officiel.':result.dateCheckStatus==='error'?`Échec de la vérification : ${result.dateCheckError||'site indisponible'}. Consulte l’annonce officielle.`:'Page consultée : aucune date de publication explicite trouvée.';tip(msg,result.dateCheckStatus==='verified'?'success':'error');}return;}
  if(action==='open-job'){const job=ui.state.jobs.find(j=>j.id===id);if(job)await perform(()=>window.radar.openUrl(job.url));return;}
  if(action==='import-document'){
    const originPage=ui.page;
    const imported=await perform(()=>window.radar.importDocument(kind),'Document importé en local.');
    // A new CV is an identity-changing event: always rebuild the visible profile,
    // even when imported from the Documents page after onboarding.
    if(imported && kind==='cv' && ui.state.documents.cv?.text){
      const profile=await perform(()=>window.radar.buildProfileFast(),'CV analysé : vérifie les informations avant de lancer la recherche.');
      if(profile){if(ui.page===originPage)ui.page='onboarding';render();}
    }
    return;
  }
  if(action==='document-kind'){ui.docKind=kind;render();return;}
  if(action==='detail-kind'){ui.detailKind=kind;render();return;}
  if(action==='save-document'){const text=document.getElementById('source-text')?.value;await perform(()=>window.radar.saveDocumentText(kind,text),'Document source enregistré.');return;}
  if(action==='generate'){await perform(()=>window.radar.generate(id,kind),'Document adapté. Vérifie chaque affirmation.');return;}
  if(action==='save-generated'){const text=document.getElementById('generated-text')?.value;await perform(()=>window.radar.saveGenerated(id,kind,text),'Version corrigée enregistrée.');return;}
  if(action==='export'){
    const text=document.getElementById('generated-text')?.value;
    await perform(async()=>{if(text)await window.radar.saveGenerated(id,kind,text);return window.radar.exportGenerated(id,kind,node.dataset.format)},'Export terminé si un emplacement a été choisi.');return;
  }
  if(action==='refresh-models'){ui.models=await window.radar.models();render();tip(ui.models.connected?`${ui.models.models.length} modèle(s) détecté(s).`:'Ollama est hors ligne.',ui.models.connected?'success':'error');return;}
  if(action==='install-qwen') {void startQwenDownload();return;}
  if(action==='choose-model'){await perform(()=>window.radar.saveSettings({selectedModel:node.dataset.model}),'Modèle sélectionné.');return;}
  if(action==='install-catalog-model'){
    if(!ui.models.connected){tip('Lance Ollama avant de télécharger un modèle.','error');return;}
    void startQwenDownload(node.dataset.model);return;
  }
  if(action==='open-model-library'){await perform(()=>window.radar.openUrl('https://ollama.com/library/qwen2.5'));return;}
  if(action==='wallpaper-pick'){
    const picked=await perform(()=>window.radar.wallpaperImport(),'Fond importé en local (optimisé automatiquement si nécessaire).');
    if(picked?.dataUrl)ui.wallpaperData=picked.dataUrl;
    render();return;
  }
  if(action==='wallpaper-clear'){
    const cleared=await perform(()=>window.radar.wallpaperClear(),'Image de fond retirée.');
    if(cleared)ui.wallpaperData='';render();return;
  }
  if(action==='get-ollama'){await perform(()=>window.radar.openOllama());return;}
  if(action==='open-settings'){ui.page='settings';render();return;}
  if(action==='rule-delete'){await perform(()=>window.radar.deleteRule(id),'Règle supprimée.');return;}
  if(action==='source-clear'){await perform(()=>window.radar.sourceCredentials(id,{clear:true}),'Identifiants supprimés.');return;}
  if(action==='build-profile'){const originPage=ui.page;const result=await perform(()=>window.radar.buildProfile());if(result){tip(`Profil généré (${result.method}). Vérifie toutes les informations avant de confirmer.`);if(ui.page===originPage)render();}return;}
  if(action==='scan-now'){const result=await perform(()=>window.radar.scanNow());if(result){ui.jobDistances={};ui.distanceVersion='';if(ui.state.settings.jobsSort==='distance')void refreshDistances();tip(`${result.imported} offre(s) ajoutée(s), ${result.notified} alerte(s) envoyée(s).`);}return;}
  if(action==='open-github'){await window.radar.openUrl('https://github.com/AkshiiGIT');return;}
  if(action==='open-repository'){await window.radar.openUrl(ui.state.creator.repositoryUrl);return;}
  if(action==='open-creator-linkedin'){await window.radar.openContact('linkedin');return;}
  if(action==='open-creator-email'){await window.radar.openContact('email');return;}
  if(action==='telegram-copy-pair'){if(ui.telegramPairing?.code){try{await navigator.clipboard.writeText(ui.telegramPairing.code);tip('Clé copiée. Colle-la dans le chat de ton bot.');}catch(error){tip('Sélectionne le code ci-dessus pour le copier.','error');}}return;}
  if(action==='email-copy'){await perform(()=>window.radar.emailCopy(id),'E-mail copié (ajoute les deux DOCX dans ton client e-mail).');return;}
  if(action==='email-draft'){await perform(()=>window.radar.emailDraft(id,false),'Brouillon .eml ouvert ou enregistré.');return;}
  if(action==='email-export'){await perform(()=>window.radar.emailDraft(id,true),'Brouillon .eml exporté.');return;}
  if(action==='open-botfather'){await window.radar.openUrl('https://t.me/BotFather');return;}
  if(action==='telegram-open-pair'){if(ui.telegramPairing?.url)await window.radar.openUrl(ui.telegramPairing.url);return;}
  if(action==='telegram-pair'){
    try{ui.telegramPairing=await window.radar.telegramBeginPairing();render();tip('Lien créé. Termine la liaison depuis Telegram.');}
    catch(error){tip(error.message||'Impossible de créer le lien.','error');}
    return;
  }
  if(action==='telegram-test'){await perform(()=>window.radar.telegramTest(),'Message test envoyé sur Telegram.');return;}
  if(action==='telegram-review'){await perform(()=>window.radar.telegramReview(id),'CV et lettre envoyés sur Telegram pour validation.');return;}
  if(action==='send-validated'){const job=ui.state.jobs.find(j=>j.id===id);if(job?.status==='erreur_envoi'&&!window.confirm('Le précédent envoi est incertain : le recruteur peut avoir reçu le dossier. Veux-tu vraiment réessayer ?'))return;await perform(()=>window.radar.sendValidated(id),'Demande d’envoi traitée. Consulte le statut.');return;}
  if(action==='rules-go'){ui.page='rules';render();return;}
  if(action==='monitor-go'){ui.page='monitor';render();return;}
  if(action==='refresh-followup'){await loadState();tip('Suivi actualisé.');return;}
});
appEl.addEventListener('change', async event=>{
  const el=event.target;
  if(el.closest('form'))ui.dirty=true;
  if(el.name==='field' && el.closest('.rule-edit-form, #new-rule-form')) {syncRuleMatchUI(el);return;}
  if(el.name==='mode' && el.closest('.rule-edit-form, #new-rule-form')) {syncRuleMatchUI(el.closest('form').querySelector('select[name="field"]'));return;}
  if(el.id==='model-selector'){await perform(()=>window.radar.saveSettings({selectedModel:el.value}),'Modèle sélectionné.');}
  if(el.id==='theme-selector'){await perform(()=>window.radar.saveSettings({theme:el.value}));}
  if(el.id==='appearance-style'){await perform(()=>window.radar.saveSettings({appearanceStyle:el.value}));}
  if(el.id==='wallpaper-mode'){
    if(el.value==='image'&&!ui.wallpaperData){tip('Importe une image pour activer le fond personnalisé.','error');render();}
    else await perform(()=>window.radar.saveSettings({wallpaperMode:el.value}));
  }
  if(el.id==='glass-tint'){if(/^#[0-9a-f]{6}$/i.test(el.value))await perform(()=>window.radar.saveSettings({glassTint:el.value}),'Teinte appliquée.');}
  if(el.id==='glass-tint-hex'){if(/^#[0-9a-f]{6}$/i.test(el.value))await perform(()=>window.radar.saveSettings({glassTint:el.value}),'Teinte appliquée.');else tip('Couleur invalide : utilise #RRGGBB.','error');}
  if(el.id==='glass-intensity'){await perform(()=>window.radar.saveSettings({glassIntensity:Number(el.value)}));}
  if(el.id==='reduce-effects'){await perform(()=>window.radar.saveSettings({reduceEffects:el.checked}));}
  if(el.id==='job-filter'){ui.filter=el.value;render();}
  if(el.id==='job-sort'){
    const mode=el.value;
    if(!['score','recent','distance'].includes(mode))return;
    ui.state.settings.jobsSort=mode;render();
    try{ui.state=await window.radar.saveSettings({jobsSort:mode});}catch(error){tip(error.message||'Impossible d’enregistrer le tri','error');}
    if(mode==='distance')await refreshDistances();else render();
  }
  if(el.classList.contains('status-select')){await perform(()=>window.radar.setJobStatus(el.dataset.id,el.value),'Statut mis à jour.');}
});
appEl.addEventListener('input', event=>{
  const geoRow=event.target.closest('.geo-zone');
  if(geoRow){
    const index=Number(geoRow.dataset.index);
    if(Array.isArray(ui.geoDraft)&&ui.geoDraft[index]){
      if(event.target.classList.contains('geo-city'))ui.geoDraft[index].city=event.target.value;
      if(event.target.classList.contains('geo-radius')){
        ui.geoDraft[index].radiusKm=Number(event.target.value);
        const label=document.getElementById(`geo-radius-label-${index}`);
        if(label)label.textContent=`${event.target.value} km`;
      }
      ui.dirty=true;
    }
    return;
  }
  if(event.target.id==='glass-tint-hex'){
    const hex=event.target.value.trim();
    if(/^#[0-9a-f]{6}$/i.test(hex)){document.documentElement.style.setProperty('--ar-tint-rgb',[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', '));}
    ui.dirty=true;return;
  }
  if(event.target.id==='glass-intensity'){document.getElementById('intensity-label').textContent=`${event.target.value} %`;return;}
  if(event.target.id==='job-search'){
    ui.search=event.target.value;
    const index=event.target.selectionStart;
    render();
    const input=document.getElementById('job-search');
    input?.focus();input?.setSelectionRange(index,index);
  } else if(event.target.closest('form') || event.target.id==='generated-text')ui.dirty=true;
});
appEl.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.target;
  if(ui.busy||!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form).entries());
  if(form.id==='geo-search-form'){const zones=Array.from(form.querySelectorAll('.geo-zone')).map(row=>({city:row.querySelector('.geo-city').value.trim(),radiusKm:Number(row.querySelector('.geo-radius').value)}));const saved=await perform(()=>window.radar.saveSettings({searchZones:zones,sector:data.sector}),'Villes, rayons et secteur enregistrés. Relance la recherche pour actualiser les offres.');if(saved){ui.geoDraft=null;ui.jobDistances={};ui.distanceVersion='';if(ui.state.settings.jobsSort==='distance')void refreshDistances();else render();}return;}
  if(form.id==='new-rule-form'){await perform(()=>window.radar.addRule({...data,enabled:true}),'Règle ajoutée.');return;}
  if(form.classList.contains('rule-edit-form')){await perform(()=>window.radar.updateRule(form.dataset.id,{...data,enabled:!!form.elements.enabled.checked}),'Règle enregistrée.');return;}
  if(form.id==='visibility-form'){
    const enabled=new Set(ui.state.settings.sourceEnabled||[]);
    if(form.elements.enableLba.checked)enabled.add('labonnealternance');else enabled.delete('labonnealternance');
    const updated=await perform(()=>window.radar.saveSettings({excludePrivateSchools:!form.elements.showTrainingListings.checked,sourceEnabled:[...enabled]}),'Préférences d’annonces enregistrées. Relance la recherche pour interroger les sources modifiées.');
    if(updated)render();return;
  }
  if(form.id==='sources-form'){const enabled=[...form.querySelectorAll('input[name=source]:checked')].map(el=>el.value);await perform(()=>window.radar.saveSettings({sourceEnabled:enabled}),'Sources automatiques enregistrées.');return;}
  if(form.classList.contains('source-credential-form')){await perform(()=>window.radar.sourceCredentials(form.dataset.id,data),'Clés enregistrées localement.');return;}
  if(form.id==='monitor-form'){const types=selectedContracts(form);if(!types.length){tip('Coche Alternance, Stage ou les deux.','error');return;}await perform(()=>window.radar.saveSettings({searchTypes:types,excludePrivateSchools:!!form.elements.excludePrivateSchools.checked,monitoringEnabled:!!form.elements.monitoringEnabled.checked,autoPrepare:!!form.elements.autoPrepare.checked,autoStart:!!form.elements.autoStart.checked,telegramApprovalsEnabled:!!form.elements.telegramApprovalsEnabled.checked,intervalMinutes:Number(data.intervalMinutes),maxNotificationsPerScan:Number(data.maxNotificationsPerScan),deliveryMode:data.deliveryMode}),'Surveillance configurée.');return;}
  if(form.id==='telegram-form'){const saved=await perform(()=>window.radar.telegramSave({chatId:data.chatId,token:data.token,clearToken:!!form.elements.clearToken.checked}),'Configuration Telegram enregistrée.');if(saved){ui.telegramHealth=null;render();}return;}
  if(form.id==='smtp-form'){await perform(()=>window.radar.smtpSave({...data,clearPassword:!!form.elements.clearPassword.checked}),'SMTP configuré.');return;}
  if(form.classList.contains('job-recruiter-form')){await perform(()=>window.radar.saveJobRecruiter(form.dataset.id,data),'Contact RH enregistré localement.');return;}
  if(form.classList.contains('job-email-form')){await perform(()=>window.radar.saveJobEmail(form.dataset.id,data.applicationEmail),'Adresse de candidature enregistrée.');return;}
  if(form.id==='rules-options-form'){await perform(()=>window.radar.saveSettings({excludeUnknownEducation:!!form.elements.excludeUnknownEducation.checked,strictCareer:!!form.elements.strictCareer.checked,autoEducationLimit:!!form.elements.autoEducationLimit.checked}),'Traitement des niveaux inconnus modifié.');return;}
  if(form.id==='profile-form'){
    const types=selectedContracts(form);if(!types.length){tip('Sélectionne Alternance, Stage ou les deux.','error');return;}
    const savedTypes=await perform(()=>window.radar.saveSettings({searchTypes:types}),'Types de recherche enregistrés.');
    if(!savedTypes)return;
    const result=await perform(()=>window.radar.saveProfile(data),'Profil enregistré sur ton PC. Recherche automatique en cours…');
    if(result){
      const fromOnboarding=ui.page==='onboarding';
      if(fromOnboarding){await perform(()=>window.radar.saveSettings({monitoringEnabled:!!form.elements.autoMonitor?.checked}));}
      ui.page=fromOnboarding?'jobs':ui.page;render();
      if(fromOnboarding){
        const scan=await perform(()=>window.radar.scanNow());
        if(scan)tip(`${scan.imported} offre(s) compatible(s) ajoutée(s). Consulte « Surveillance » pour l’état des sources.`);
      }
    }
    return;
  }
  if(form.id==='add-job-form'){
    const result=await perform(()=>window.radar.addJob(data),'Offre enregistrée.');
    if(result){ui.jobId=result.jobs[0]?.id||'';render();}
  }
  if(form.id==='board-form'){
    const result=await perform(()=>window.radar.importBoard(data.url,!!form.elements.onlyAlternance.checked));
    if(result)tip(`${result.imported} nouvelle(s) offre(s) parmi ${result.total} consultées.`);
  }
});
async function initialize(){
  try {
    if(!window.radar)throw new Error('Application desktop requise. Lance AlterRADAR depuis son application installée.');
    if(window.radar.platform)document.documentElement.dataset.platform=window.radar.platform;
    window.radar.onModelPull(info=>{ui.modelProgress=info;paintModelPull();});
    const [state,system,models,modelCatalog,wallpaperData,pullStatus] = await Promise.all([window.radar.state(),window.radar.system(),window.radar.models(),window.radar.qwenCatalog?.()||Promise.resolve([]),window.radar.wallpaperGet?.()||Promise.resolve(''),window.radar.modelPullStatus?.()||Promise.resolve(null)]);
    ui.modelCatalog=modelCatalog;ui.wallpaperData=wallpaperData||'';ui.modelProgress=pullStatus||ui.modelProgress;
    ui.state=state;ui.system=system;ui.models=models;
    if(!state.settings.selectedModel&&models.models.length) {
      const suggested=models.models.find(m=>m.name===system.recommended);
      const selected=(suggested||models.models[0]).name;
      ui.state=await window.radar.saveSettings({selectedModel:selected});
    }
    ui.page=state.settings.onboardingCompleted?'dashboard':'onboarding';
    render();
    if(ui.state.settings.jobsSort==='distance')refreshDistances();
  } catch(error) {
    appEl.innerHTML=`<div class="loading-screen"><div class="brand-mark large">${icon('radar')}</div><h2>Impossible d’ouvrir AlterRADAR</h2><p>${esc(error.message)}</p></div>`;
  }
}
initialize();
// Les vérifications réseau n'interrompent pas le défilement ni un formulaire actif.
if(window.radar?.onPublicationDate)window.radar.onPublicationDate(update=>{
  if(!ui.state||!update?.id)return;
  const job=ui.state.jobs.find(j=>j.id===update.id);
  if(!job)return;Object.assign(job,update);
  const badge=jobDateBadge(job);
  document.querySelectorAll('[data-publication-id]').forEach(node=>{if(node.dataset.publicationId===update.id)node.outerHTML=badge;});
});
// Background monitoring continues in Electron, but the UI must NEVER be rebuilt
// on a timer.  Re-check once when the user returns to the window, and update
// the DOM only if the server-side state actually changed. The “Actualiser le suivi”
// button remains available while the window stays focused.
window.addEventListener('focus',()=>{
  if(ui.state&&!ui.busy&&!ui.dirty&&!document.querySelector('input:focus, textarea:focus, select:focus'))
    loadState({skipUnchanged:true}).catch(()=>{});
});

// Reflet liquide discret sur les boutons. Aucun listener global au document ni animation si effets réduits.
appEl.addEventListener('pointermove',event=>{
  if(document.body.dataset.reduceEffects==='true')return;
  const button=event.target.closest('.btn,.nav-item,.icon-button');
  if(!button)return;
  const bounds=button.getBoundingClientRect();
  button.style.setProperty('--bubble-x',`${Math.round(event.clientX-bounds.left)}px`);
  button.style.setProperty('--bubble-y',`${Math.round(event.clientY-bounds.top)}px`);
},{passive:true});
