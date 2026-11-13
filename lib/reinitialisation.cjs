'use strict';
/**
 * Réinitialisation complète : efface ce qu'AlterRADAR a écrit dans son dossier de données,
 * comme si l'application venait d'être installée.
 *
 * Effacé : radar-data.json (profil, CV, lettre, offres, candidatures, historique, règles,
 * réglages, liaison Telegram, mot de passe SMTP chiffré), l'image de fond, les sauvegardes
 * de candidats précédents et les brouillons e-mail (.eml avec pièces jointes).
 * Conservé : Ollama et ses modèles (application séparée) et les fichiers que l'utilisateur
 * a exportés ailleurs. Le stockage de Chromium (cache, stockage local) est vidé à part,
 * par la session Electron, pendant que l'application tourne.
 */
const nodeFs = require('node:fs');
const path = require('node:path');

const FICHIERS = Object.freeze([
  'radar-data.json', 'radar-data.json.tmp',
  'alterradar-wallpaper.png', 'alterradar-wallpaper.jpg', 'alterradar-wallpaper.webp',
  'self-test.pdf'
]);
const DOSSIERS = Object.freeze(['candidate-backups', 'drafts']);
const CONFIRMATION = 'REINITIALISER';

/** « réinitialiser », « RÉINITIALISER », « Reinitialiser » : accents et casse ignorés. */
function confirmationValide(saisie) {
  return String(saisie || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase() === CONFIRMATION;
}

/** Supprime uniquement les noms connus, à l'intérieur du dossier de données. Renvoie ce qui existait. */
function effacerDonneesLocales(dossier, { fs = nodeFs } = {}) {
  if (!dossier || !path.isAbsolute(dossier)) throw new Error('Dossier de données invalide.');
  const effaces = [];
  for (const nom of [...FICHIERS, ...DOSSIERS]) {
    const cible = path.join(dossier, nom);
    if (path.dirname(cible) !== path.resolve(dossier)) continue; // jamais en dehors du dossier
    if (!fs.existsSync(cible)) continue;
    fs.rmSync(cible, { recursive: DOSSIERS.includes(nom), force: true });
    effaces.push(nom);
  }
  return effaces;
}

module.exports = { effacerDonneesLocales, confirmationValide, CONFIRMATION, FICHIERS, DOSSIERS };
