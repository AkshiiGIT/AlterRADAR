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
const STATUS = ['nouvelle','à examiner','cv_en_cours','lettre_en_cours','dossier_prêt','en_attente_validation','à_revoir','validée','à_envoyer','en_cours_envoi','postulée','en_attente_reponse','entretien','refusée','acceptée','erreur_envoi'];
const statusName = key => ui.state?.statuses?.[key] || key;
const ui = {page:'onboarding',state:null,system:null,models:{connected:false,models:[],error:''},jobId:'',search:'',filter:'toutes',docKind:'cv',detailKind:'letter',busy:false,dirty:false,toast:null,telegramPairing:null,modelProgress:null,modelCatalog:[],wallpaperData:''};
const appEl = document.getElementById('app');

const icon = (name,cls='') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const esc = value => String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const nfmt = n => new Intl.NumberFormat('fr-FR').format(n);
const datefmt = date => {try{return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'}).format(new Date(date));}catch{return ''}};
const initials = name => (String(name||'RA').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()||'RA');
const gb = size => `${(Number(size||0)/1e9).toFixed(1)} Go`;
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
  return (ui.state?.jobs||[]).filter(j=>j.eligible).filter(j=>{
    const hay=`${j.title} ${j.company} ${j.location}`.toLowerCase();
    if(ui.page==='jobs' && (!hay.includes(ui.search.toLowerCase()) ||
      !(ui.filter==='toutes'||(ui.filter==='alternance'&&j.contractTypes?.includes('alternance'))||
        (ui.filter==='stage'&&j.contractTypes?.includes('stage'))||(ui.filter==='fort'&&j.score>=60))))return false;
    return true;
  }).sort((a,b)=>b.score-a.score);
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
    <div class="sidebar-bottom"><div class="creator-credit">Créé par <strong>Akasche MAHINTAN</strong></div><div class="privacy-pill">${icon('shield')}<div><strong>Données privées</strong><br>Local, sauf envois autorisés.</div></div>
    <button class="side-profile" data-nav="documents" title="Mes documents" aria-label="Mes documents" style="width:100%;text-align:left;cursor:pointer"><span class="avatar">${esc(initials(profile.name))}</span><span><strong>${esc(profile.name||'Mon espace')}</strong><small>Compte local · ${ui.system?.platform==='darwin'?'macOS':ui.system?.platform==='win32'?'Windows':'Desktop'}</small></span>${icon('chevron','s')}</button></div>
  </aside>`;
}
function topbar(){
  return `<header class="topbar"><div class="eyebrow">L’ESSENTIEL, SANS LE BRUIT.</div><div class="topright"><span class="desktop-tag">${ui.models.connected ? `<span style="color:var(--success)">●</span> Ollama connecté` : '<span style="color:var(--warning)">●</span> Ollama hors ligne'}</span><button class="icon-button" data-action="theme" title="Changer de thème" aria-label="Changer de thème">${icon(ui.state.settings.theme==='dark'?'sun':'moon')}</button><span class="avatar" style="width:35px;height:35px;border-radius:50%">${esc(initials(ui.state.profile.name))}</span></div></header>`;
}
function pageHeader(kicker,title,subtitle='',action='') {
  return `<div class="page-title" style="display:flex;justify-content:space-between;align-items:end;gap:18px"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${subtitle?`<p class="subheading">${subtitle}</p>`:''}</div>${action}</div>`;
}
function jobRow(job){return `<button class="job-row" data-action="select-job" data-id="${esc(job.id)}"><span class="company-logo">${esc(initials(job.company))}</span><span class="job-main"><span class="job-name">${esc(job.title)}</span><span class="job-meta">${esc(job.company)} · ${esc(job.contractTypes?.join(' / ')||'Type non identifié')} · ${esc(job.location||'Lieu non précisé')} · ${esc(job.source||'Source non indiquée')} · ${esc(job.atsName&&job.atsId?`ATS : ${job.atsName}`:'ATS non identifié')} · ${datefmt(job.addedAt)}</span></span><span class="score-badge" title="Indice d’affinité, pas une probabilité de recrutement">${job.score}/100</span>${icon('chevron','s chevron')}</button>`}
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
    <div class="job-toolbar"><div class="search-field">${icon('search')}<input id="job-search" placeholder="Rechercher un poste, une entreprise, une ville…" value="${esc(ui.search)}" /></div><select id="job-filter"><option value="toutes" ${ui.filter==='toutes'?'selected':''}>Toutes les offres</option><option value="alternance" ${ui.filter==='alternance'?'selected':''}>Alternances</option><option value="stage" ${ui.filter==='stage'?'selected':''}>Stages</option><option value="fort" ${ui.filter==='fort'?'selected':''}>Score ≥ 60 %</option></select></div>
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
  return `<div class="card selected-card"><div class="card-header"><div><h3>${esc(job.title)}</h3><div class="subtitle">${esc(job.company)} · ${esc(job.contractTypes?.join(' / ')||'Type non identifié')} · ${esc(job.location||'Non précisé')} · ${esc(job.source||'Source inconnue')} · ${esc(job.atsName&&job.atsId?`ATS : ${job.atsName}`:'ATS non identifié')}</div></div><span class="score-badge">${job.score}/100</span></div>
    <div class="inline-actions"><button class="btn small" data-action="open-job" data-id="${esc(job.id)}">Voir l’offre ${icon('up-right','s')}</button><select class="status-select" data-id="${esc(job.id)}" aria-label="Statut de candidature">${STATUS.map(st=>`<option value="${esc(st)}" ${job.status===st?'selected':''}>${esc(statusName(st))}</option>`).join('')}</select></div>
    <div class="progress-line space-top"><span class="tag ${cvReady?'good':'warn'}">${icon(cvReady?'check':'clock','s')} CV ${cvReady?'rédigé':'à préparer'}</span><span class="tag ${letterReady?'good':'warn'}">${icon(letterReady?'check':'clock','s')} Lettre ${letterReady?'rédigée':'à préparer'}</span><span class="tag ${mask(job.status)}">${esc(statusName(job.status))}</span></div>
    <div class="rule"></div><h3>Pourquoi cette offre ?</h3><div class="match-explanation">${(job.matchExplanations||[]).map(reason=>`<p class="note">${icon('check','s')} ${esc(reason)}</p>`).join('') || '<p class="note">Aucune justification disponible.</p>'}<p class="note">Le score est indicatif, ce n’est pas une probabilité de recrutement.</p></div><div class="rule"></div><h3>Contact RH & envoi</h3><p class="note space-top">AlterRADAR préremplit une adresse professionnelle lorsqu’elle est publiée dans le texte de l’offre. Vérifie-la avant l’envoi. Aucune adresse n’est devinée ni extraite de profils LinkedIn privés.</p>
    <form class="job-recruiter-form space-top" data-id="${esc(job.id)}"><div class="form-grid"><div class="field"><label>Nom du contact RH (facultatif)</label><input name="recruiterName" value="${esc(job.recruiterName||'')}" placeholder="Nom réel, si connu" /></div><div class="field"><label>Fonction (facultatif)</label><input name="recruiterRole" value="${esc(job.recruiterRole||'')}" placeholder="Chargé(e) de recrutement" /></div><div class="field full"><label>Profil LinkedIn public du contact (facultatif)</label><input name="recruiterLinkedin" type="url" value="${esc(job.recruiterLinkedin||'')}" placeholder="https://www.linkedin.com/in/..." /></div><div class="field full"><label>E-mail officiel de candidature (facultatif)</label><input type="email" name="applicationEmail" value="${esc(job.applicationEmail||'')}" placeholder="recrutement@entreprise.fr" /></div></div><button class="btn small space-top" type="submit">Enregistrer les coordonnées</button></form>
    ${allReady ? `<div class="review-card space-top"><div><strong>CV et lettre préparés</strong><p class="note">Versions stockées localement et modifiables à tout moment.</p></div><div class="inline-actions"><button class="btn primary small" data-action="telegram-review" data-id="${esc(job.id)}" ${!ui.state.settings.telegramApprovalsEnabled||!ui.state.settings.telegramConfigured?'disabled':''}>${icon('send','s')} Envoyer à Telegram pour valider</button>${['validée','à_envoyer','erreur_envoi'].includes(job.status)&&job.approvedDigest?`<button class="btn small" data-action="email-draft" data-id="${esc(job.id)}">${icon('file','s')} Ouvrir .eml</button><button class="btn small" data-action="email-export" data-id="${esc(job.id)}">${icon('download','s')} Exporter .eml</button><button class="btn small ghost" data-action="email-copy" data-id="${esc(job.id)}">Copier l’e-mail</button>${ui.state.settings.deliveryMode==='auto'&&mailReady?`<button class="btn primary small" data-action="send-validated" data-id="${esc(job.id)}">Envoyer via SMTP</button>`:''}`:''}</div>${!ui.state.settings.telegramApprovalsEnabled?`<p class="note">${link('monitor-go','Configurer les validations Telegram')}</p>`:''}</div>`:''}
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
    <div class="column-flow">${list.length?list.map(r=>`<form class="rule-row rule-edit-form" data-id="${esc(r.id)}"><div class="rule-top"><label class="hint-check"><input type="checkbox" name="enabled" ${r.enabled?'checked':''}/> Activer</label><button type="button" class="btn small ghost" data-action="rule-delete" data-id="${esc(r.id)}">Supprimer</button></div><div class="rule-form"><select name="field" aria-label="Type de règle">${opt(r.field,r.field)}</select><input name="value" value="${esc(r.value)}" placeholder="Ex. 3, Paris, Java…" maxlength="350"/><select name="mode" aria-label="Correspondance"><option value="any" ${r.mode==='any'?'selected':''}>Un des termes</option><option value="all" ${r.mode==='all'?'selected':''}>Tous les termes</option></select><button class="btn small" type="submit">Enregistrer</button></div></form>`).join(''):empty('filter','Aucune règle','Ajoute une règle : sans règle active, aucune annonce ne sera exclue.')}</div>
    <div class="rule"></div><h3>Nouvelle règle</h3><form id="new-rule-form" class="rule-form space-top"><select name="field" aria-label="Type de nouveau filtre">${opt('text_exclude')}</select><input name="value" placeholder="Ex. Java, Paris, 3…" maxlength="350"/><select name="mode"><option value="any">Un des termes</option><option value="all">Tous les termes</option></select><button class="btn primary small" type="submit">${icon('plus','s')} Ajouter</button></form>
    <p class="note space-top">Pour le niveau Bac+3 : choisis « Niveau d’études maximum requis » et saisis <strong>3</strong>. Les mentions explicites Bac+4, Bac+5, M1 et M2 seront exclues. Les annonces ambiguës demandent une vérification humaine.</p>
  </section><section class="card space-top"><div class="card-header"><h3>Niveau non indiqué</h3>${icon('shield')}</div><p class="lead">Certains sites ne précisent pas le diplôme exigé. Tu décides de les afficher ou non.</p><form id="rules-options-form" class="rule-options space-top"><label class="hint-check"><input type="checkbox" name="autoEducationLimit" ${ui.state.settings.autoEducationLimit!==false?'checked':''}/> <strong>Exclure automatiquement les offres exigeant un niveau supérieur au mien</strong> (recommandé)</label><p class="note">Si ton profil indique Bac+3, les offres explicitement réservées aux Bac+4 et Bac+5 sont exclues même si une ancienne règle manuelle est désactivée.</p><label class="hint-check"><input type="checkbox" name="strictCareer" ${ui.state.settings.strictCareer!==false?'checked':''}/> <strong>Masquer les métiers sans lien avec mon CV et ma formation</strong> (recommandé)</label><p class="note">Ex. un développeur web ne verra plus les postes d'assistant RH ou de commercial. Désactive cette option uniquement si tu veux explorer d'autres métiers.</p><label class="hint-check"><input type="checkbox" name="excludeUnknownEducation" ${ui.state.settings.excludeUnknownEducation?'checked':''}/> Exclure également les annonces sans niveau détectable</label><button class="btn small" type="submit">Sauvegarder</button></form></section>`;
}
function monitorPage(){
 const {settings,boards,monitoring}=ui.state;
 const last=monitoring?.lastResult;
 return `${pageHeader('AUTOMATISATION LOCALE','Surveillance & Telegram','Laisse ton ordinateur allumé : AlterRADAR surveille les stages et/ou alternances encore disponibles, selon ton choix, puis applique tes filtres.')}<div class="alert">${icon('info')}<span>Ce mode cherche et notifie automatiquement. Il prépare les dossiers avec Ollama et peut envoyer les CV et lettres sur Telegram avec <strong>validation explicite</strong>. Après approbation, un brouillon e-mail avec deux pièces jointes est généré ; si tu le choisis, un envoi SMTP peut être tenté pour une adresse de recrutement vérifiée. Les formulaires ATS restent manuels. Les annonces provenant d’écoles privées peuvent être exclues.</span></div>
 <section class="card space-top"><div class="card-header"><div><h3>Surveillance en continu</h3><p class="subtitle">Gratuite, exécutée sur ton ordinateur. Connexion Internet requise.</p></div><span class="tag ${settings.monitoringEnabled?'good':'warn'}">${settings.monitoringEnabled?'Activée':'Désactivée'}</span></div>
 <form id="monitor-form"><div class="form-grid"><div class="field"><label>Fréquence des recherches</label><select name="intervalMinutes">${[15,30,60,120,240,720,1440].map(n=>`<option value="${n}" ${Number(settings.intervalMinutes)===n?'selected':''}>${n<60?`${n} minutes`:n<1440?`${n/60} heure(s)`:'24 heures'}</option>`).join('')}</select></div></div>
 <div class="form-grid space-top"><div class="field"><label>Alertes maximum par scan</label><select name="maxNotificationsPerScan">${[3,6,12,20,30,50].map(n=>`<option value="${n}" ${Number(settings.maxNotificationsPerScan||12)===n?'selected':''}>${n} dossiers</option>`).join('')}</select></div><div class="field"><label>Après validation Telegram</label><select name="deliveryMode"><option value="draft" ${settings.deliveryMode!=='auto'?'selected':''}>Brouillon .eml, envoi manuel (recommandé)</option><option value="auto" ${settings.deliveryMode==='auto'?'selected':''}>Envoi SMTP si disponible ; sinon brouillon</option></select></div></div>
 <div class="space-top">${contractCheckboxes(settings)}</div><div class="space-top check-stack"><label class="hint-check"><input name="excludePrivateSchools" type="checkbox" ${settings.excludePrivateSchools!==false?'checked':''}/> Masquer les annonces publiées par des écoles privées et organismes de formation</label><label class="hint-check"><input name="monitoringEnabled" type="checkbox" ${settings.monitoringEnabled?'checked':''}/> Activer la surveillance en arrière-plan</label><label class="hint-check"><input name="autoStart" type="checkbox" ${settings.autoStart?'checked':''}/> Démarrer AlterRADAR à l’ouverture de ma session</label><label class="hint-check"><input name="autoPrepare" type="checkbox" ${settings.autoPrepare?'checked':''}/> Préparer automatiquement les CV et lettres (selon la limite d’alertes choisie)</label><label class="hint-check"><input name="telegramApprovalsEnabled" type="checkbox" ${settings.telegramApprovalsEnabled?'checked':''}/> Autoriser l’envoi des documents et leur validation depuis mon chat Telegram privé</label></div>
 <div class="inline-actions space-top"><button class="btn primary" type="submit">${icon('check','s')} Enregistrer</button><button type="button" data-action="scan-now" class="btn">${icon('refresh','s')} Lancer un scan maintenant</button></div></form>
 <div class="rule"></div><div class="info-line">${icon('clock','s')} Dernier scan : ${monitoring?.lastScanAt?esc(new Date(monitoring.lastScanAt).toLocaleString('fr-FR')):'Jamais'}</div><div class="info-line">${icon('briefcase','s')} ${last?`${last.imported} annonce(s) découverte(s) · ${last.notified} notification(s)`:'Aucun résultat pour le moment'}</div>${last?.errors?.length?`<div class="alert error space-top">${esc(last.errors.slice(0,3).join(' | '))}</div>`:''}</section>
 <section class="card space-top"><div class="card-header"><div><h3>Sources automatiques</h3><p class="subtitle">Aucune URL à saisir. Les flux gratuits démarrent automatiquement. Réglages avancés facultatifs.</p></div><span class="tag">${(settings.sourceEnabled||[]).length} activées</span></div>
 <p class="note">Les sources publiques sont consultées sans lien à saisir. Le flux communautaire français est limité à la tech et peut être incomplet. Les clés France Travail et Adzuna sont facultatives mais vivement recommandées en France. La Bonne Alternance n’est pas la source principale. Les API possèdent des limites, donc l’application ne peut pas garantir toutes les annonces du Web.</p>
 <details class="space-top"><summary class="advanced-summary">Options avancées · Activer des sources supplémentaires</summary><form id="sources-form" class="space-top"><div class="source-grid">${(ui.state.sources||[]).map(source=>{
   const status=(monitoring?.sourceResults||[]).find(x=>x.id===source.id);
   const enabled=(settings.sourceEnabled||[]).includes(source.id);
   return `<div class="source-item"><label class="hint-check"><input type="checkbox" name="source" value="${esc(source.id)}" ${enabled?'checked':''} /><strong>${esc(source.name)}</strong></label><small>${esc(source.region)} · ${esc(source.note)}</small><div class="inline-actions space-top"><span class="tag ${status?.status==='ok'?'good':status?.status==='error'?'warn':''}">${status?.status==='ok'?`${status.count} annonces lues`:status?.status==='error'?'Erreur API':status?.status==='skipped'?'Actualisation différée':'Pas encore interrogée'}</span>${source.auth!=='none'?`<span class="tag ${settings.sourceCredentialStatus?.[source.id]?'good':'warn'}">${settings.sourceCredentialStatus?.[source.id]?'Clé enregistrée':'Clé facultative requise'}</span>`:''}</div>${status?.reason?`<small>${esc(status.reason)}</small>`:''}</div>`;}).join('')}</div><button class="btn primary small space-top" type="submit">${icon('check','s')} Enregistrer les sources</button></form>
 <div class="rule"></div><details class="ats-disclosure"><summary>Détection des ATS (30 plateformes) · Afficher la couverture</summary><p class="note">Les URL des annonces sont analysées automatiquement. Quand une annonce pointe vers un tableau public reconnu, AlterRADAR peut aussi chercher les autres postes de cet employeur (6 tableaux maximum par scan, actualisation limitée). Être reconnu ne garantit pas qu’une API publique ou une candidature automatique soit disponible.</p><div class="source-grid space-top">${(ui.state.atsCatalog||[]).map(ats=>`<div class="source-item"><strong>${esc(ats.name)}</strong><div class="inline-actions space-top"><span class="tag ${ats.discovery==='public-api'?'good':''}">${ats.discovery==='public-api'?'Connecteur public (à vérifier)':'Reconnaissance URL'}</span></div></div>`).join('')}</div></details>
 <div class="rule"></div><h3>Configurer les API avec identifiants</h3><p class="note">Ces identifiants sont facultatifs et chiffrés dans le coffre macOS/Windows. Ils ne sont pas intégrés au code source ni visibles dans l’interface après sauvegarde.</p>
 ${(ui.state.sources||[]).filter(src=>src.auth!=='none').map(src=>`<form class="source-credential-form space-top" data-id="${esc(src.id)}"><strong>${esc(src.name)}</strong><div class="form-grid space-top">${src.id==='francetravail'?`<div class="field"><label>Identifiant client</label><input name="clientId" autocomplete="off" required /></div><div class="field"><label>Secret client</label><input type="password" name="clientSecret" autocomplete="new-password" required /></div><div class="field full"><label>Portée OAuth (optionnelle)</label><input name="scope" placeholder="api_offresdemploiv2 o2dsoffre" /></div>`:src.id==='adzuna'?`<div class="field"><label>App ID</label><input name="appId" autocomplete="off" required /></div><div class="field"><label>App Key</label><input type="password" name="appKey" autocomplete="new-password" required /></div>`:`<div class="field full"><label>Clé API</label><input type="password" name="apiKey" autocomplete="new-password" required /></div>`}</div><div class="inline-actions space-top"><button type="submit" class="btn small">${icon('check','s')} Enregistrer la clé</button>${settings.sourceCredentialStatus?.[src.id]?`<button type="button" class="btn small ghost" data-action="source-clear" data-id="${esc(src.id)}">Supprimer la clé</button>`:''}</div></form>`).join('')}
 </details></section><div class="two-cols space-top">
 <section class="card"><div class="card-header"><h3>Connecter mon bot Telegram</h3>${icon('send')}</div><p class="lead">Chaque utilisateur connecte <strong>son propre bot Telegram gratuit</strong>. Il n’y a aucun bot AlterRADAR central ni serveur du créateur recevant tes documents.</p>
 <div class="step-list space-top"><div class="step"><span class="step-num">1</span><div><strong>Créer ton bot avec @BotFather</strong><p>Ouvre BotFather dans Telegram, lance /newbot et copie le jeton secret. Ne le partage jamais.</p></div></div><div class="step"><span class="step-num">2</span><div><strong>Enregistrer le jeton ci-dessous</strong><p>Il reste dans le coffre de ton ordinateur. Un nouveau jeton déconnecte automatiquement l’ancien chat.</p></div></div><div class="step"><span class="step-num">3</span><div><strong>Saisir la clé générée dans ton bot</strong><p>Copie la clé depuis AlterRADAR, puis colle-la dans le chat privé de ton bot. Pas besoin de Chat ID. La clé expire après 10 minutes.</p></div></div></div>
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
    <section class="card"><div class="card-header"><div><h2>Modèle IA local</h2><div class="subtitle">Choisis un modèle déjà installé dans Ollama.</div></div><span class="tag ${connected?'good':'warn'}">${connected?`${icon('check','s')} Ollama connecté`:'Ollama hors ligne'}</span></div>
    <div class="metric-row"><div class="metric"><small>RAM totale</small><strong>${esc(system.totalGb??'—')} Go</strong><small>${esc(system.freeGb??'—')} Go libres selon le système</small></div><div class="metric"><small>Modèle conseillé</small><strong style="font-size:16px;margin:5px 0">${esc(reco||'IA locale déconseillée')}</strong><small>Estimation selon la mémoire disponible</small></div></div>
    <div class="settings-row"><div class="settings-label"><strong>Modèle utilisé par AlterRADAR</strong><span>Seuls les modèles réellement présents sur cette machine apparaissent ici. Ton choix est mémorisé et prioritaire.</span></div><div class="settings-control"><select id="model-selector" ${!list.length?'disabled':''}><option value="">${!connected?'Ollama indisponible':!list.length?'Aucun modèle installé':'Sélectionner un modèle'}</option>${list.map(m=>`<option value="${esc(m.name)}" ${m.name===selected?'selected':''}>${esc(m.name)} · ${gb(m.size)}</option>`).join('')}</select></div></div>
    <div class="settings-row"><div class="settings-label"><strong>Modèles détectés</strong><span>${list.length} modèle(s) trouvé(s). Leur taille correspond à l’espace disque, pas à l’utilisation exacte de RAM.</span></div><button class="btn small" data-action="refresh-models">${icon('refresh','s')} Actualiser</button></div>
    ${selected && !selectedValid && connected ? `<div class="alert error">${icon('info')} Le modèle précédemment choisi (${esc(selected)}) n’est plus installé. Sélectionne un modèle de la liste.</div>`:''}
    ${list.length?`<div class="model-list">${list.map(m=>`<div class="model-option ${selected===m.name?'active':''}"><div><strong>${esc(m.name)} ${m.name===reco?'<span class="tag good" style="margin-left:7px">Recommandé</span>':''}</strong><small>${gb(m.size)} sur le disque · ${esc(m.parameters||m.family||'Paramètres non indiqués')} ${m.quantization?`· ${esc(m.quantization)}`:''}</small></div>${selected===m.name?`<span class="tag good">${icon('check','s')} Actif</span>`:`<button data-action="choose-model" data-model="${esc(m.name)}">Utiliser</button>`}</div>`).join('')}</div>`:empty('cpu','Aucun modèle disponible',connected?'Télécharge un modèle avec Ollama puis actualise la liste.':'Démarre Ollama pour détecter les modèles installés.')}
    </section>
    <div class="two-cols" style="margin-top:20px"><section class="card"><div class="card-header"><h3>Installer un nouveau modèle</h3>${icon('download')}</div><p class="lead" style="font-size:12px">Ollama est un moteur IA séparé. Il doit être installé et lancé sur ce PC ou Mac.</p><div class="step-list space-top"><div class="step"><span class="step-num">1</span><div><strong>Installer et lancer Ollama</strong><p>Disponible sur Windows et macOS. Pas de compte obligatoire.</p></div></div><div class="step"><span class="step-num">2</span><div><strong>Télécharger le modèle conseillé</strong><p>Utilise le bouton « Installer Qwen recommandé en 1 clic » ci-dessous. En cas de difficulté, commande de secours :</p><div class="codepill" style="margin-top:8px">${esc(reco?`ollama pull ${reco}`:'ollama pull qwen2.5:1.5b')}</div></div></div><div class="step"><span class="step-num">3</span><div><strong>Actualiser la liste</strong><p>Choisis ensuite le modèle téléchargé, ou n’importe quel modèle déjà installé.</p></div></div></div><div class="inline-actions space-top"><button class="btn primary" data-action="install-qwen" ${!reco||!connected||ui.busy?'disabled':''}>${icon('download','s')} ${list.some(m=>m.name===reco)?'Sélectionner Qwen recommandé':'Installer Qwen recommandé en 1 clic'}</button><button class="btn" data-action="open-model-library">Voir les modèles Qwen ${icon('up-right','s')}</button><button class="btn" data-action="get-ollama">Site Ollama ${icon('up-right','s')}</button><button class="btn" data-action="refresh-models">Actualiser ${icon('refresh','s')}</button></div>${ui.modelProgress?`<div class="note space-top">${esc(ui.modelProgress.status)} ${ui.modelProgress.percent===null?'':`· ${ui.modelProgress.percent}%`}</div><div class="pull-track"><div class="pull-bar" style="width:${ui.modelProgress.percent||0}%"></div></div>`:''}<div class="model-market space-top"><h4>Bibliothèque Qwen · Installation locale</h4><p class="note">Sélectionne le modèle qui te convient. Les modèles nécessitant davantage de RAM restent disponibles, mais affichent un avertissement.</p><div class="model-market-grid">${ui.modelCatalog.map(model=>`<div class="model-market-item"><div><strong>${esc(model.label)}</strong><small>${esc(model.note)} · RAM conseillée : ${model.minRam} Go${Number(ui.system?.totalGb||0)<model.minRam?' · RAM probablement insuffisante':''}</small></div><button class="btn small" data-action="install-catalog-model" data-model="${esc(model.name)}" ${!connected||ui.busy?'disabled':''}>${list.some(x=>x.name===model.name)?'Choisir':'Installer'}</button></div>`).join('')}</div></div><p class="note space-top">Le téléchargement est gratuit mais nécessite Internet et plusieurs Go de disque. Il ne démarre qu'après ton clic. Une recommandation basée sur la RAM totale n'est pas une garantie de mémoire disponible au moment de la génération.</p></section>
    <section class="card"><div class="card-header"><h3>Confidentialité</h3>${icon('shield')}</div><div class="info-line">${icon('shield','s')} Documents enregistrés dans les données locales de l’app</div><div class="info-line">${icon('cpu','s')} Inférence envoyée uniquement à Ollama sur 127.0.0.1</div><div class="info-line">${icon('search','s')} Internet pour offres, Telegram et SMTP si activés</div><div class="info-line">${icon('check','s')} Aucun envoi de candidature sans validation</div><p class="note space-top">La détection de RAM est indicative. Un gros modèle peut manquer de mémoire, même si son téléchargement est possible. Les scores ne sont pas des probabilités de recrutement.</p></section></div>
    <section class="card space-top appearance-settings"><div class="card-header"><div><h2>Apparence personnalisée</h2><p class="subtitle">Un fond local, une interface sobre ou un verre dépoli teinté. Les réglages sont enregistrés sur ce PC.</p></div>${icon('sparkles')}</div>
      <div class="appearance-grid">
        <div class="field"><label for="theme-selector">Thème</label><select id="theme-selector"><option value="dark" ${ui.state.settings.theme==='dark'?'selected':''}>Sombre</option><option value="light" ${ui.state.settings.theme==='light'?'selected':''}>Clair</option><option value="system" ${ui.state.settings.theme==='system'?'selected':''}>Suivre le système</option></select></div>
        <div class="field"><label for="appearance-style">Effet des panneaux</label><select id="appearance-style"><option value="solid" ${ui.state.settings.appearanceStyle==='solid'?'selected':''}>Classique · opaque</option><option value="glass" ${ui.state.settings.appearanceStyle==='glass'?'selected':''}>Liquid Glass · translucide</option><option value="tinted" ${ui.state.settings.appearanceStyle==='tinted'?'selected':''}>Liquid Glass · teinté</option></select></div>
        <div class="field"><label for="wallpaper-mode">Fond de l'application</label><select id="wallpaper-mode"><option value="none" ${ui.state.settings.wallpaperMode==='none'?'selected':''}>Uni · discret</option><option value="gradient" ${ui.state.settings.wallpaperMode==='gradient'?'selected':''}>Dégradé artistique</option><option value="image" ${ui.state.settings.wallpaperMode==='image'?'selected':''}>Image personnelle ${ui.wallpaperData?'(chargée)':'(à importer)'}</option></select></div>
        <div class="field"><label for="glass-tint">Teinte du verre</label><div class="color-control"><input id="glass-tint" type="color" value="${esc(ui.state.settings.glassTint||'#9b8bff')}" aria-label="Couleur de la teinte" /><span>Choisir une couleur</span></div></div>
        <div class="field"><label for="glass-intensity">Intensité du verre · <span id="intensity-label">${Number(ui.state.settings.glassIntensity??50)} %</span></label><input id="glass-intensity" type="range" min="0" max="100" step="5" value="${Number(ui.state.settings.glassIntensity??50)}" /></div>
        <div class="field"><label>Performances</label><label class="hint-check"><input id="reduce-effects" type="checkbox" ${ui.state.settings.reduceEffects?'checked':''}/> Réduire les effets visuels (moins de flou)</label></div>
      </div>
      <div class="inline-actions space-top"><button class="btn" data-action="wallpaper-pick">${icon('upload','s')} Importer une image (PNG/JPG/WebP)</button><button class="btn ghost" data-action="wallpaper-clear">${icon('refresh','s')} Retirer l'image</button></div>
      <p class="note space-top">L'image est enregistrée dans les données locales d'AlterRADAR, jamais dans le dépôt Git ni sur un serveur. L'effet reste facultatif pour privilégier la lisibilité.</p>
    </section>
    <section class="card space-top about-alterradar"><div class="card-header"><h3>À propos d’AlterRADAR</h3>${icon('info')}</div>
 <p class="lead"><strong>AlterRADAR</strong> · Version 0.12.0 · Application gratuite et open source pour Windows et macOS.</p>
 <p class="creator-about">Créé et développé par <strong>Akasche MAHINTAN</strong>.</p>
 <div class="about-points space-top"><div class="about-point"><strong>${icon('shield','s')} Tes données restent sur ton ordinateur par défaut.</strong><p>Ton profil, tes documents, tes règles de tri, tes candidatures et ton historique sont conservés localement. Les modèles Ollama génèrent tes documents sur ton propre PC. AlterRADAR ne possède pas de serveur central de comptes, de CV ou de télémétrie.</p></div>
 <div class="about-point"><strong>${icon('user','s')} Le créateur n’a pas accès à tes données personnelles.</strong><p>Akasche MAHINTAN ne reçoit pas les fichiers enregistrés sur ton appareil et ne peut pas consulter ton dossier depuis AlterRADAR. Attention : tes fichiers locaux ne sont pas chiffrés au repos ; protège ta session.</p></div>
 <div class="about-point"><strong>${icon('send','s')} Tu contrôles les envois externes.</strong><p>Quand tu actives Telegram, les alertes et éventuellement le CV/lettre sont envoyés aux serveurs Telegram ; quand tu postes par e-mail, ils passent par ton fournisseur e-mail et le recruteur. Les recherches d’offres contactent les plateformes d’emploi. Ces tiers appliquent leurs propres règles de confidentialité.</p></div>
 <div class="about-point"><strong>${icon('check','s')} Gratuit à télécharger et à utiliser.</strong><p>Sans abonnement, sans clé d’IA payante, sous licence MIT. Le code source et les installateurs seront publiés sur le dépôt GitHub public akshiiGIT/AlterRADAR une fois les builds validés. Ollama et un modèle compatible sont nécessaires pour la génération IA ; Internet et électricité restent à ta charge.</p></div></div>
 <div class="rule"></div><h3>Contacter le créateur</h3><div class="inline-actions space-top"><button class="btn" data-action="open-repository">${icon('up-right','s')} GitHub · akshiiGIT/AlterRADAR</button>${ui.state.creator?.linkedinUrl?`<button class="btn" data-action="open-creator-linkedin">${icon('up-right','s')} LinkedIn · Akasche MAHINTAN</button>`:`<span class="note">LinkedIn : lien du profil à compléter avant la publication.</span>`}<button class="btn" data-action="open-creator-email">${icon('send','s')} ${esc(ui.state.creator?.email||'Contacter le créateur')}</button></div>
 <p class="note space-top">© 2026 Akasche MAHINTAN · Licence MIT. Les messages Telegram ne sont pas des conversations secrètes chiffrées de bout en bout.</p></section>`;
}
function applyAppearance(){
  const settings=ui.state?.settings||{};
  document.body.dataset.appearance=settings.appearanceStyle||'solid';
  document.body.dataset.wallpaper=settings.wallpaperMode||'none';
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
  document.body.dataset.theme=ui.state.settings.theme==='system' ? ((window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark') : ui.state.settings.theme;
  applyAppearance();
  const views={onboarding,dashboard,jobs,documents,applications,rules:rulesPage,monitor:monitorPage,settings};
  // Keep the reader's position when an in-page action refreshes the view.
  // Navigation to another page starts from the top, as expected.
  const oldMain=appEl.querySelector('.main-area');
  const previousScroll=oldMain&&ui.lastRenderedPage===ui.page?oldMain.scrollTop:0;
  appEl.innerHTML=`<div class="app-shell">${sidebar()}<main class="main-area">${topbar()}${(views[ui.page]||dashboard)()}</main></div>`;
  appEl.querySelector('.main-area').scrollTop=previousScroll;
  ui.lastRenderedPage=ui.page;
  drawToast();
}
async function loadState(){ui.state=await window.radar.state();if(ui.state.settings.telegramChatId)ui.telegramPairing=null;render();}
async function refreshModels(){ui.models=await window.radar.models();render();}
async function perform(action,success){
  if(ui.busy)return;
  ui.busy=true;render();
  try {const value=await action();ui.dirty=false; await loadState();if(success)tip(success);return value;}
  catch(error){tip(error?.message||'Une erreur est survenue','error');return null;}
  finally{ui.busy=false;render();}
}
appEl.addEventListener('click',async(event)=>{
  const node=event.target.closest('[data-action],[data-nav]');
  if(!node || ui.busy)return;
  if(node.dataset.nav){ui.page=node.dataset.nav;ui.jobId='';ui.dirty=false;render();return;}
  const id=node.dataset.id,kind=node.dataset.kind,action=node.dataset.action;
  if(action==='theme'){const theme=ui.state.settings.theme==='dark'?'light':'dark';await perform(()=>window.radar.saveSettings({theme}));return;}
  if(action==='all-jobs'){ui.page='jobs';render();return;}
  if(action==='select-job'){ui.page='jobs';ui.jobId=id;render();return;}
  if(action==='application-detail'){ui.page='applications';ui.jobId=id;render();return;}
  if(action==='focus-new-job'){document.getElementById('add-job')?.scrollIntoView({behavior:'smooth'});document.querySelector('#add-job-form input')?.focus();return;}
  if(action==='open-job'){const job=ui.state.jobs.find(j=>j.id===id);if(job)await perform(()=>window.radar.openUrl(job.url));return;}
  if(action==='import-document'){
    const imported=await perform(()=>window.radar.importDocument(kind),'Document importé en local.');
    if(imported && ui.state.documents.cv?.text && ui.page==='onboarding'){
      const profile=await perform(()=>window.radar.buildProfileFast(),'Profil créé rapidement : vérifie et confirme les informations.');
      if(profile)ui.page='onboarding';
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
  if(action==='install-qwen'){
    ui.modelProgress={status:'Connexion à Ollama…',percent:0};
    const installed=await perform(()=>window.radar.installRecommendedModel(),'Modèle Qwen installé et sélectionné.');
    ui.models=await window.radar.models();
    if(installed)ui.modelProgress={status:installed.alreadyInstalled?'Modèle déjà installé, sélectionné':'Modèle installé avec succès',percent:100};
    render();return;
  }
  if(action==='choose-model'){await perform(()=>window.radar.saveSettings({selectedModel:node.dataset.model}),'Modèle sélectionné.');return;}
  if(action==='install-catalog-model'){
    if(!ui.models.connected){tip('Lance Ollama avant de télécharger un modèle.','error');return;}
    ui.modelProgress={status:'Connexion à Ollama…',percent:0};
    const installed=await perform(()=>window.radar.installModel(node.dataset.model),'Modèle téléchargé et sélectionné.');
    ui.models=await window.radar.models();
    if(installed)ui.modelProgress={status:installed.alreadyInstalled?'Modèle déjà installé, sélectionné':'Modèle installé avec succès',percent:100};
    render();return;
  }
  if(action==='open-model-library'){await perform(()=>window.radar.openUrl('https://ollama.com/library/qwen2.5'));return;}
  if(action==='wallpaper-pick'){
    const picked=await perform(()=>window.radar.wallpaperImport(),'Fond personnalisé importé en local.');
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
  if(action==='build-profile'){const result=await perform(()=>window.radar.buildProfile());if(result)tip(`Profil généré (${result.method}). Vérifie toutes les informations avant de confirmer.`);return;}
  if(action==='scan-now'){const result=await perform(()=>window.radar.scanNow());if(result)tip(`${result.imported} offre(s) ajoutée(s), ${result.notified} alerte(s) envoyée(s).`);return;}
  if(action==='open-github'){await window.radar.openUrl('https://github.com/akshiiGIT');return;}
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
  if(el.id==='model-selector'){await perform(()=>window.radar.saveSettings({selectedModel:el.value}),'Modèle sélectionné.');}
  if(el.id==='theme-selector'){await perform(()=>window.radar.saveSettings({theme:el.value}));}
  if(el.id==='appearance-style'){await perform(()=>window.radar.saveSettings({appearanceStyle:el.value}));}
  if(el.id==='wallpaper-mode'){
    if(el.value==='image'&&!ui.wallpaperData){tip('Importe une image pour activer le fond personnalisé.','error');render();}
    else await perform(()=>window.radar.saveSettings({wallpaperMode:el.value}));
  }
  if(el.id==='glass-tint'){await perform(()=>window.radar.saveSettings({glassTint:el.value}));}
  if(el.id==='glass-intensity'){await perform(()=>window.radar.saveSettings({glassIntensity:Number(el.value)}));}
  if(el.id==='reduce-effects'){await perform(()=>window.radar.saveSettings({reduceEffects:el.checked}));}
  if(el.id==='job-filter'){ui.filter=el.value;render();}
  if(el.classList.contains('status-select')){await perform(()=>window.radar.setJobStatus(el.dataset.id,el.value),'Statut mis à jour.');}
});
appEl.addEventListener('input', event=>{
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
  if(form.id==='new-rule-form'){await perform(()=>window.radar.addRule({...data,enabled:true}),'Règle ajoutée.');return;}
  if(form.classList.contains('rule-edit-form')){await perform(()=>window.radar.updateRule(form.dataset.id,{...data,enabled:!!form.elements.enabled.checked}),'Règle enregistrée.');return;}
  if(form.id==='sources-form'){const enabled=[...form.querySelectorAll('input[name=source]:checked')].map(el=>el.value);await perform(()=>window.radar.saveSettings({sourceEnabled:enabled}),'Sources automatiques enregistrées.');return;}
  if(form.classList.contains('source-credential-form')){await perform(()=>window.radar.sourceCredentials(form.dataset.id,data),'Clés enregistrées localement.');return;}
  if(form.id==='monitor-form'){const types=selectedContracts(form);if(!types.length){tip('Coche Alternance, Stage ou les deux.','error');return;}await perform(()=>window.radar.saveSettings({searchTypes:types,excludePrivateSchools:!!form.elements.excludePrivateSchools.checked,monitoringEnabled:!!form.elements.monitoringEnabled.checked,autoPrepare:!!form.elements.autoPrepare.checked,autoStart:!!form.elements.autoStart.checked,telegramApprovalsEnabled:!!form.elements.telegramApprovalsEnabled.checked,intervalMinutes:Number(data.intervalMinutes),maxNotificationsPerScan:Number(data.maxNotificationsPerScan),deliveryMode:data.deliveryMode}),'Surveillance configurée.');return;}
  if(form.id==='telegram-form'){await perform(()=>window.radar.telegramSave({chatId:data.chatId,token:data.token,clearToken:!!form.elements.clearToken.checked}),'Configuration Telegram enregistrée.');return;}
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
    window.radar.onModelPull(info=>{ui.modelProgress=info; if(ui.page==='settings')render();});
    const [state,system,models,modelCatalog,wallpaperData] = await Promise.all([window.radar.state(),window.radar.system(),window.radar.models(),window.radar.qwenCatalog?.()||Promise.resolve([]),window.radar.wallpaperGet?.()||Promise.resolve('')]);
    ui.modelCatalog=modelCatalog;ui.wallpaperData=wallpaperData||'';
    ui.state=state;ui.system=system;ui.models=models;
    if(!state.settings.selectedModel&&models.models.length) {
      const suggested=models.models.find(m=>m.name===system.recommended);
      const selected=(suggested||models.models[0]).name;
      ui.state=await window.radar.saveSettings({selectedModel:selected});
    }
    ui.page=state.settings.onboardingCompleted?'dashboard':'onboarding';
    render();
  } catch(error) {
    appEl.innerHTML=`<div class="loading-screen"><div class="brand-mark large">${icon('radar')}</div><h2>Impossible d’ouvrir AlterRADAR</h2><p>${esc(error.message)}</p></div>`;
  }
}
initialize();
// Actualise les réponses reçues via Telegram sans interrompre un formulaire en cours.
window.addEventListener('focus',()=>{if(ui.state&&!ui.busy&&!ui.dirty)loadState().catch(()=>{});});
setInterval(()=>{
  if(ui.state && !ui.busy && !ui.dirty && !document.querySelector('input:focus, textarea:focus, select:focus') && document.visibilityState==='visible')loadState().catch(()=>{});
},20000);
