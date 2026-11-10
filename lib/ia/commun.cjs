'use strict';
/**
 * Briques partagées par les trois fonctions IA et par leurs deux transports
 * (onglet Electron via IPC, serveur HTTP via SSE).
 *
 * Chaque fonction IA est un générateur asynchrone qui produit des évènements :
 *   { delta: 'texte' }                         un fragment de réponse
 *   { sources: [{ titre, score }] }            les extraits retenus (RAG)
 *   { done: true, usage: { entree, sortie, ms } }  la clôture, toujours en dernier
 * Le transport se contente de les acheminer : SSE pour HTTP, messages IPC pour Electron.
 */
const { ModeleIndisponible } = require('./modele.cjs');

/** Entrée du client refusée. Devient un 400 avec un corps JSON. */
class RequeteInvalide extends Error {
  constructor(message) { super(message); this.name = 'RequeteInvalide'; }
}

/** Règle 4 du contrat : chaque appel est journalisé (modèle, tokens, durée, issue). */
function creerJournal({ taille = 50, ecrire = console.log } = {}) {
  const entrees = [];
  return {
    noter({ route, modele, entree = 0, sortie = 0, ms = 0, issue = 'ok' }) {
      const ligne = { le: new Date().toISOString(), route, modele: String(modele || '?'), entree, sortie, ms: Math.round(ms), issue };
      entrees.unshift(ligne);
      entrees.length = Math.min(entrees.length, taille);
      // Jamais le contenu du prompt ni de la réponse : seulement des métadonnées.
      ecrire(`[ia] ${ligne.route} modele=${ligne.modele} entree=${entree} sortie=${sortie} ms=${ligne.ms} issue=${issue}`);
      return ligne;
    },
    lister: () => entrees.map(e => ({ ...e }))
  };
}

const maintenant = () => performance.now();

function fin(usage, debut) {
  return { done: true, usage: { entree: usage.entree || 0, sortie: usage.sortie || 0, ms: Math.round(maintenant() - debut) } };
}

/**
 * Démarre un flux en consommant son PREMIER évènement avant de répondre.
 *
 * Une fois le flux ouvert (en-têtes HTTP envoyés), il est trop tard pour annoncer
 * une erreur. On attend donc le premier évènement : s'il échoue, l'appelant peut
 * encore renvoyer un vrai 400 ou 503. Sinon on rend ce premier évènement et la suite.
 */
async function demarrer(generateur) {
  const premier = await generateur.next();
  return {
    premier: premier.done ? null : premier.value,
    suite: generateur
  };
}

/** Traduit une erreur levée AVANT le flux en code HTTP et message neutre (règle 5 : rien ne fuit). */
function codeErreur(erreur) {
  if (erreur instanceof RequeteInvalide) return { code: 400, erreur: erreur.message };
  if (erreur instanceof ModeleIndisponible) return { code: 503, erreur: 'modele indisponible' };
  return { code: 500, erreur: 'erreur interne' };
}

/** Une chaîne non vide, nettoyée, de longueur bornée ; sinon RequeteInvalide. */
function texteValide(valeur, max, message) {
  if (typeof valeur !== 'string' || valeur.length > max) throw new RequeteInvalide(message);
  const propre = valeur.replace(/\u0000/g, '').trim();
  if (!propre) throw new RequeteInvalide(message);
  return propre;
}

module.exports = { RequeteInvalide, creerJournal, fin, maintenant, demarrer, codeErreur, texteValide };
