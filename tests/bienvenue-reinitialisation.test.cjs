'use strict';
/**
 * Guide de bienvenue (premier démarrage) et réinitialisation complète depuis Paramètres.
 * Le scénario complet a aussi été joué dans le vrai Electron : guide, détection d'Ollama,
 * réinitialisation, fichiers supprimés, fenêtre rechargée.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { effacerDonneesLocales, confirmationValide, FICHIERS, DOSSIERS } = require('../lib/reinitialisation.cjs');

const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('réinitialisation : seuls les fichiers d’AlterRADAR sont effacés, rien autour', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'alterradar-reinit-'));
  try {
    for (const nom of FICHIERS) fs.writeFileSync(path.join(dossier, nom), 'x');
    for (const nom of DOSSIERS) { fs.mkdirSync(path.join(dossier, nom)); fs.writeFileSync(path.join(dossier, nom, 'a.json'), '{}'); }
    fs.writeFileSync(path.join(dossier, 'Preferences'), '{}'); // fichier de Chromium : géré par la session
    fs.mkdirSync(path.join(dossier, 'Local Storage'));
    const effaces = effacerDonneesLocales(dossier);
    assert.deepEqual(effaces.sort(), [...FICHIERS, ...DOSSIERS].sort());
    assert.deepEqual(fs.readdirSync(dossier).sort(), ['Local Storage', 'Preferences']);
    assert.deepEqual(effacerDonneesLocales(dossier), [], 'deuxième passage : rien à effacer, aucune erreur');
    assert.throws(() => effacerDonneesLocales('relatif/AlterRADAR'), /invalide/);
    assert.throws(() => effacerDonneesLocales(''), /invalide/);
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
});

test('réinitialisation : confirmation tapée, accents et casse ignorés', () => {
  for (const ok of ['RÉINITIALISER', 'réinitialiser', ' Reinitialiser ', 'REINITIALISER']) assert.equal(confirmationValide(ok), true, ok);
  for (const non of ['', 'oui', 'reinit', 'RÉINITIALISER !', null, undefined, 42]) assert.equal(confirmationValide(non), false, String(non));
});

test('processus principal : confirmation vérifiée, refus pendant un scan, état neuf écrit puis fenêtre rechargée', () => {
  const main = src('electron/main.cjs');
  const bloc = main.slice(main.indexOf("ipcMain.handle('app:reset-all'"), main.indexOf("ipcMain.handle('app:wallpaper-clear'"));
  assert.ok(bloc.length > 200, 'gestionnaire app:reset-all présent');
  const ordre = ['confirmationValide(confirmation)', 'if(scanning)', 'effacerDonneesLocales(dossier)', 'state=initialState()', 'persist()', 'assistantIA=null', 'updateMonitoring()', 'clearStorageData()', '.reload()'];
  let position = -1;
  for (const etape of ordre) {
    const ici = bloc.indexOf(etape);
    assert.ok(ici > position, `étape « ${etape} » présente et dans l’ordre`);
    position = ici;
  }
  // Le fichier recréé empêche la migration « Radar Alternance » de ressusciter d'anciennes données.
  assert.match(main, /if \(!fs\.existsSync\(userFile\)\) \{\s*for \(const previousName of \['Radar Alternance'/);
  assert.match(src('electron/preload.cjs'), /resetAll: confirmation => ipcRenderer\.invoke\('app:reset-all',confirmation\)/);
});

test('premier démarrage : guide ouvert si welcomeSeen est faux, jamais imposé aux utilisateurs déjà installés', () => {
  const main = src('electron/main.cjs');
  assert.match(main, /backgroundHintShown:false,welcomeSeen:false \}/, 'nouvelle installation : guide à afficher');
  assert.match(main, /welcomeSeen:typeof saved\.settings\?\.welcomeSeen==='boolean'\?saved\.settings\.welcomeSeen:saved\.settings\?\.onboardingCompleted===true/, 'mise à jour : profil déjà créé = guide déjà vu');
  assert.match(main, /'telegramApprovalsEnabled','welcomeSeen'\]\) if\(/, 'réglage enregistrable, en booléen strict');
  const app = src('renderer/app.js');
  assert.match(app, /render\(\);\s*if\(!ui\.state\.settings\.welcomeSeen\)bienvenueOuvrir\(0\);/);
  assert.match(app, /const BIENVENUE_ETAPES=\['Bienvenue','Ollama','Modèle IA','Ton CV'\];/);
  assert.match(app, /saveSettings\(\{welcomeSeen:true\}\)/, 'fermer le guide le marque comme vu');
  assert.match(app, /data-action="ouvrir-guide"/, 'guide rouvrable depuis Paramètres');
});

test('interface : le guide reflète l’état réel et la réinitialisation exige la saisie', () => {
  const app = src('renderer/app.js');
  assert.match(app, /bienvenue\.etape===1&&!ui\.models\.connected/, 'détection d’Ollama tant qu’il est absent');
  assert.match(app, /setInterval\(async\(\)=>\{[\s\S]{0,200}window\.radar\.models\(\)/);
  assert.match(app, /data-action="reinit-confirmer" disabled>/, 'bouton désactivé par défaut');
  assert.match(app, /bouton\.disabled=!confirmationReinit\(event\.target\.value\)/);
  assert.match(app, /if\(!confirmationReinit\(saisie\)\)return;/);
  assert.match(app, /Conservé :<\/b> Ollama et les modèles IA téléchargés/);
  assert.doesNotMatch(app, /localStorage\.clear|indexedDB\.deleteDatabase/, 'l’interface n’efface rien elle-même');
  const reinit = app.slice(app.indexOf("if(action==='reinit-demander')"), app.indexOf("if(action==='reinit-confirmer')") + 600);
  assert.match(reinit, /window\.radar\.resetAll\(saisie\)/);
  assert.doesNotMatch(reinit, /window\.confirm\(|\balert\(/, 'pas de boîte de dialogue bloquante');
});
