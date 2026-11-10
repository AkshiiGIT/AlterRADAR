'use strict';
/**
 * Vérification des dates v2 : redirecteurs déballés, pages lourdes, extraction élargie,
 * affichage caché en repli, dates des API France Travail et Adzuna.
 * Les règles de preuve restent celles de publication-date-verification.test.cjs.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const d = require('../lib/publication-date.cjs');
const { fetchProvider } = require('../lib/sources.cjs');

const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const reply = x => ({ ok: true, json: async () => x });
const HOLEEST = 'https://r.holeest.com/redirect?jd_token=E0vDqh&o=1&from=https%3A%2F%2Fwww.hellowork.com%2Ffr-fr%2Femplois%2F83985618.html%3Futm_source%3Dbonnealternance%26utm_term%3D83985618';
const JSONLD = titre => `<script type="application/ld+json">{"@type":"JobPosting","title":"${titre}","datePosted":"2026-10-30"}</script>`;

test('redirecteur r.holeest.com : la page vérifiée est l’annonce finale, sans paramètres de suivi', async () => {
  assert.equal(d.urlDeVerification(HOLEEST), 'https://www.hellowork.com/fr-fr/emplois/83985618.html');
  assert.equal(d.urlDeVerification('https://jobs.makesense.org/fr/jobs/x?source=ft&utm_campaign=y'), 'https://jobs.makesense.org/fr/jobs/x?source=ft');
  assert.match(d.urlDeVerification('https://r.holeest.com/redirect?from=javascript:alert(1)'), /^https:\/\/r\.holeest\.com\/redirect\?/, 'cible non HTTPS ignorée');
  const vues = [];
  const r = await d.verifyJobDate({ url: HOLEEST, title: 'Préparateur de commandes' }, { fetchPage: async url => { vues.push(url); return JSONLD('Préparateur de commandes'); } });
  assert.deepEqual(vues, ['https://www.hellowork.com/fr-fr/emplois/83985618.html']);
  assert.equal(r.publishedAt, '2026-10-30');
});

test('repli : une page bloquée en lecture simple est lue telle qu’affichée, avec les mêmes preuves', async () => {
  const job = { url: 'https://www.exemple-emploi.fr/offre/1', title: 'Développeur React H/F' };
  const bloque = async () => { throw new Error('HTTP 403'); };
  const ok = await d.verifyJobDate(job, { fetchPage: bloque, renderPage: async () => JSONLD('Développeur React H/F') });
  assert.equal(ok.dateCheckStatus, 'verified');
  assert.equal(ok.publicationEvidence, 'Schema.org JobPosting.datePosted (page affichée)');
  const autreOffre = await d.verifyJobDate(job, { fetchPage: bloque, renderPage: async () => JSONLD('Commercial senior') });
  assert.equal(autreOffre.dateCheckStatus, 'unavailable', 'page affichée mais aucune preuve pour CETTE offre');
  assert.equal(autreOffre.publishedAt, '');
  const deuxEchecs = await d.verifyJobDate(job, { fetchPage: bloque, renderPage: async () => { throw new Error('Délai d’affichage dépassé'); } });
  assert.equal(deuxEchecs.dateCheckStatus, 'error');
  assert.match(deuxEchecs.dateCheckError, /HTTP 403 ; affichage : Délai/);
});

test('repli : lecture simple réussie mais sans date, la page affichée est consultée', async () => {
  let affichages = 0;
  const job = { url: 'https://www.exemple-emploi.fr/offre/2', title: 'Data analyst' };
  const r = await d.verifyJobDate(job, { fetchPage: async () => '<div id="app"></div>', renderPage: async () => { affichages++; return '<p>Publiée le 28/10/2026</p>'; } });
  assert.equal(affichages, 1);
  assert.equal(r.publishedAt, '2026-10-28');
  const sansRepli = await d.verifyJobDate(job, { fetchPage: async () => JSONLD('Data analyst'), renderPage: async () => { affichages++; return ''; } });
  assert.equal(sansRepli.publishedAt, '2026-10-30');
  assert.equal(affichages, 1, 'pas d’affichage quand la lecture simple suffit');
});

test('extraction : dates relatives en jours seulement, jamais en semaines ni « 30+ jours »', () => {
  const maintenant = new Date('2026-11-10T12:00:00');
  const lire = html => d.extractPublication(html, { maintenant }).date;
  assert.equal(lire('<p>Publiée il y a 3 jours</p>'), '2026-11-07');
  assert.equal(lire('<p>Publiée hier</p>'), '2026-11-09');
  assert.equal(lire('<span>Publié aujourd’hui</span>'), '2026-11-10');
  assert.equal(lire('<p>Posted 5 days ago</p>'), '2026-11-05');
  assert.equal(lire('<p>Publiée il y a 2 semaines</p>'), '');
  assert.equal(lire('<p>Publiée il y a 30+ jours</p>'), '');
  assert.equal(lire('<p>Publiée il y a 90 jours</p>'), '');
  assert.equal(lire('<p>Il y a 3 jours de télétravail par semaine</p>'), '');
  assert.match(d.extractPublication('<p>Publiée il y a 3 jours</p>', { maintenant }).evidence, /Date relative affichée/);
});

test('extraction : formulations et microdonnées courantes des sites français', () => {
  assert.equal(d.extractPublication('<p>Publiée le : 31/10/2026</p>').date, '2026-10-31');
  assert.equal(d.extractPublication('<p>Date de mise en ligne : 28 octobre 2026</p>').date, '2026-10-28');
  assert.equal(d.extractPublication('<p>En ligne depuis le 02/11/2026</p>').date, '2026-11-02');
  assert.equal(d.extractPublication('<span itemprop="datePosted" content="2026-10-07">7 octobre</span>').date, '2026-10-07');
  assert.equal(d.extractPublication('<span itemprop="datePosted" content="2026-10-07"></span><span itemprop="datePosted" content="2026-09-01"></span>').date, '', 'plusieurs offres : aucune preuve');
  const next = t => `<title>${t}</title><script id="__NEXT_DATA__">{"props":{"job":{"datePosted":"2026-10-21T10:00:00Z"}}}</script>`;
  assert.equal(d.extractPublication(next('Développeur React H/F - Studio'), { jobTitle: 'Développeur React H/F' }).date, '2026-10-21');
  assert.equal(d.extractPublication(next('Toutes nos offres'), { jobTitle: 'Développeur React H/F' }).date, '', 'page d’une autre offre ou d’une liste');
  assert.equal(d.extractPublication('<p>Actualisée le 05/11/2026</p>').date, '', 'une mise à jour n’est pas une publication');
});

test('pages lourdes : une réponse compressée tronquée reste lisible', () => {
  const html = `<html><head>${JSONLD('Dev')}</head><body>${'<p>contenu</p>'.repeat(400000)}</body></html>`;
  const gz = zlib.gzipSync(Buffer.from(html));
  const tronque = gz.subarray(0, Math.floor(gz.length / 2));
  assert.throws(() => zlib.gunzipSync(tronque), 'sans drapeau, Node refuse la réponse coupée');
  const lu = zlib.gunzipSync(tronque, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString();
  assert.equal(d.extractPublication(lu, { jobTitle: 'Dev' }).date, '2026-10-30');
  const code = src('lib/publication-date.cjs');
  assert.match(code, /maxRedirects=5/);
  assert.match(code, /'Accept-Encoding':'gzip, deflate, br'/);
  assert.match(code, /terminer\(\);req\.destroy\(\); \/\/ page lourde : on garde le début/);
});

test('affichage caché : réseau local, traceurs tiers, images et autres protocoles bloqués', () => {
  const decide = (url, type, sitePage) => d.decisionRequeteRendu({ url, type, sitePage }).annuler;
  assert.deepEqual(d.decisionRequeteRendu({ url: 'https://www.hellowork.com/fr-fr/emplois/1.html', type: 'mainFrame' }), { annuler: false, site: 'hellowork.com' });
  for (const url of ['http://www.hellowork.com/', 'https://localhost/', 'https://127.0.0.1/', 'https://192.168.1.1/', 'https://[::1]/', 'https://box.lan/', 'https://intranet/', 'file:///etc/passwd', 'https://a:b@site.fr/'])
    assert.equal(decide(url, 'mainFrame'), true, url);
  assert.equal(decide('https://static.hellowork.com/app.js', 'script', 'hellowork.com'), false, 'même site');
  assert.equal(decide('https://www.googletagmanager.com/gtm.js', 'script', 'hellowork.com'), true, 'traceur tiers');
  assert.equal(decide('https://connect.facebook.net/fbevents.js', 'xhr', 'hellowork.com'), true);
  assert.equal(decide('https://www.hellowork.com/logo.png', 'image', 'hellowork.com'), true, 'images inutiles');
  assert.equal(decide('https://cdn.hellowork.com/font.woff2', 'font', 'hellowork.com'), true);
  assert.equal(decide('https://static.example.fr/a.js', 'script', undefined), true, 'aucune page connue : rien');
  assert.equal(d.siteDe('www.pass.fonction-publique.gouv.fr'), 'fonction-publique.gouv.fr');
  assert.equal(d.siteDe('candidat.francetravail.fr'), 'francetravail.fr');
  assert.equal(d.siteDe('jobs.example.co.uk'), 'example.co.uk');
});

test('processus principal : fenêtre cachée jetable et isolée, utilisée en repli seulement', () => {
  const main = src('electron/main.cjs');
  const debut = main.indexOf('const PARTITION_DATES'), finBloc = main.indexOf('const verificationsDatesEnCours');
  assert.ok(debut > 0 && finBloc > debut, 'bloc de la fenêtre cachée repéré');
  const bloc = main.slice(debut, finBloc);
  assert.match(bloc, /const PARTITION_DATES='verification-dates'/);
  assert.doesNotMatch(bloc, /persist:/, 'session en mémoire : rien écrit sur le disque');
  for (const attendu of [/sandbox:true/, /contextIsolation:true/, /nodeIntegration:false/, /show:false/, /images:false/, /setPermissionRequestHandler\(\(_contenu,_permission,repondre\)=>repondre\(false\)\)/, /setPermissionCheckHandler\(\(\)=>false\)/, /will-download',evenement=>evenement\.preventDefault\(\)/, /setWindowOpenHandler\(\(\)=>\(\{action:'deny'\}\)\)/, /setAudioMuted\(true\)/, /setWebRTCIPHandlingPolicy\('disable_non_proxied_udp'\)/, /decisionRequeteRendu\(/, /fenetre\.destroy\(\)/])
    assert.match(bloc, attendu, String(attendu));
  assert.doesNotMatch(bloc, /preload:/, 'aucun pont vers l’application');
  assert.match(main, /renderPage:url=>afficherPagePourDate\(url\)/);
  assert.match(main, /if\(state\.settings\.verificationDatesVersion!==2\)/, 'les offres en échec sont revérifiées une fois');
  assert.match(main, /if\(verificationsDatesEnCours\.has\(id\)\)return verificationsDatesEnCours\.get\(id\);/, 'jamais deux vérifications simultanées de la même offre');
});

test('API : France Travail (dateCreation) et Adzuna (created) fournissent la date de publication', async () => {
  const offreFT = { id: '214ABCD', intitule: 'Développeur web en alternance', entreprise: { nom: 'Acme' }, lieuTravail: { libelle: '75 - Paris' }, description: 'Alternance développeur web', dateCreation: '2026-10-29T08:12:00.000Z', dateActualisation: '2026-11-08T10:00:00.000Z' };
  const fauxFT = async u => { if (u.includes('oauth2')) return reply({ access_token: 't' }); if (u.includes('geo.api.gouv.fr')) return reply([{ nom: 'Paris', code: '75056' }]); return reply({ resultats: [offreFT] }); };
  const ft = await fetchProvider('francetravail', { credentials: { clientId: 'a', clientSecret: 'b' }, zones: [{ city: 'Paris', radiusKm: 20 }], profile: { roles: 'Développeur web' }, fetchImpl: fauxFT });
  assert.equal(ft[0].publishedAt, '2026-10-29', 'date de création, jamais la date d’actualisation');
  assert.equal(ft[0].publicationEvidence, 'Date annoncée par API France Travail');
  const offreAdzuna = { title: 'Alternance développeur', company: { display_name: 'Acme' }, location: { display_name: 'Lyon' }, description: 'Alternance', redirect_url: 'https://www.adzuna.fr/land/ad/1', created: '2026-10-31T09:00:00Z' };
  const adz = await fetchProvider('adzuna', { credentials: { appId: 'i', appKey: 'k' }, zones: [{ city: 'Lyon', radiusKm: 20 }], profile: { roles: 'Développeur' }, fetchImpl: async () => reply({ results: [offreAdzuna] }) });
  assert.equal(adz[0].publishedAt, '2026-10-31');
  assert.equal(adz[0].publicationEvidence, 'Date annoncée par API Adzuna');
});
