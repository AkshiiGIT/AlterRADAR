#!/usr/bin/env node
'use strict';
/**
 * Bilan des dates de publication, site par site, à partir de TES données locales.
 * Lecture seule : aucune requête réseau, rien n'est modifié.
 *
 *   npm run dates:diagnostic
 *   npm run dates:diagnostic -- "/chemin/vers/radar-data.json"
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { urlDeVerification } = require('../lib/publication-date.cjs');

function fichierParDefaut() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'AlterRADAR', 'radar-data.json');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'AlterRADAR', 'radar-data.json');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'AlterRADAR', 'radar-data.json');
}

const fichier = process.argv[2] || fichierParDefaut();
let etat;
try { etat = JSON.parse(fs.readFileSync(fichier, 'utf8')); }
catch (erreur) { console.error(`Impossible de lire ${fichier} : ${erreur.message}`); process.exit(1); }

const offres = Array.isArray(etat.jobs) ? etat.jobs.filter(j => j.url) : [];
const sites = new Map();
const raisons = new Map();
for (const offre of offres) {
  let site = '?';
  try { site = new URL(urlDeVerification(offre.url)).hostname.replace(/^www\./, ''); } catch { /* adresse illisible */ }
  const ligne = sites.get(site) || { total: 0, datees: 0, pageAffichee: 0, sansDate: 0, echec: 0, attente: 0 };
  ligne.total++;
  if (offre.publishedAt) { ligne.datees++; if (/page affichée/.test(offre.publicationEvidence || '')) ligne.pageAffichee++; }
  else if (offre.dateCheckStatus === 'error') { ligne.echec++; const r = String(offre.dateCheckError || 'inconnue').replace(/\d{3,}/g, 'N'); raisons.set(r, (raisons.get(r) || 0) + 1); }
  else if (offre.dateCheckStatus === 'unavailable') ligne.sansDate++;
  else ligne.attente++;
  sites.set(site, ligne);
}

const total = [...sites.values()].reduce((a, l) => ({ total: a.total + l.total, datees: a.datees + l.datees, echec: a.echec + l.echec }), { total: 0, datees: 0, echec: 0 });
console.log(`${fichier}\n${total.total} offres · ${total.datees} datées (${Math.round(100 * total.datees / Math.max(1, total.total))} %) · ${total.echec} pages non consultables\n`);
console.log('Site'.padEnd(40), 'Offres', 'Datées', 'dont affichage', 'Sans date', 'Échec', 'En attente');
for (const [site, l] of [...sites].sort((a, b) => b[1].total - a[1].total)) {
  console.log(site.slice(0, 39).padEnd(40), String(l.total).padStart(6), String(l.datees).padStart(6), String(l.pageAffichee).padStart(14), String(l.sansDate).padStart(9), String(l.echec).padStart(5), String(l.attente).padStart(10));
}
if (raisons.size) {
  console.log('\nRaisons des échecs :');
  for (const [raison, n] of [...raisons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${raison}`);
}
