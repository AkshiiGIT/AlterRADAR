'use strict';
/**
 * Assistant IA d'AlterRADAR : point d'entrée unique.
 *
 *   resumer    (séance 9)   résumer une annonce, en streaming
 *   assistant  (séance 10)  suivre ses candidatures grâce à l'appel d'outil
 *   documents  (séance 13)  répondre à partir de la documentation (RAG), sources citées
 *   chat                    le chatbot de toutes les pages : un routeur choisit l'une des
 *                           fonctions ci-dessus, ou le conseil, ou refuse ce qui sort du cadre
 *
 * Deux transports utilisent ce module sans rien dupliquer :
 *   - l'onglet « Assistant IA » de l'application, via IPC (electron/main.cjs)
 *   - le serveur HTTP du contrat de cours, via SSE (serveur-ia/serveur.cjs)
 */
const { creerClient, ModeleIndisponible } = require('./modele.cjs');
const { RequeteInvalide, creerJournal, demarrer, codeErreur } = require('./commun.cjs');
const { resumer } = require('./resumer.cjs');
const { assistant } = require('./assistant.cjs');
const { documents } = require('./documents.cjs');
const { chargerCorpus, creerIndex } = require('./recherche.cjs');
const { chat, creerMemoire } = require('./chat.cjs');

const ROUTES = Object.freeze({ resumer, assistant, documents, chat });

/**
 * @param {object} config
 * @param {string}   config.base          adresse d'Ollama, connue du serveur seulement
 * @param {Function} config.modele        () => nom du modèle de génération (ex. qwen2.5:3b)
 * @param {string}   config.modeleEmbed   modèle d'embedding (ex. paraphrase-multilingual)
 * @param {Function} config.candidatures  () => [{ entreprise, poste, lieu, statut, historique, cvPret, lettrePrete }]
 * @param {Function} config.offres        () => [{ id, entreprise, poste, lieu, texte }] (résumé dans le chatbot)
 * @param {string}   config.racine        dossier qui contient README.md et docs/
 */
function creerIA({ base, modele, modeleEmbed = 'paraphrase-multilingual', candidatures, offres = () => [], racine, fetch, journal = creerJournal(), delaiAppelMs, delaiFluxMs }) {
  const client = creerClient({ base, fetch, delaiAppelMs, delaiFluxMs });
  const memoire = creerMemoire(); // historique des conversations du chatbot, gardé ici et nulle part ailleurs
  let index = null;
  const lireIndex = () => (index ||= creerIndex({ client, modeleEmbed, morceaux: chargerCorpus(racine), journal }));

  /** Ouvre le flux d'une route. Lève RequeteInvalide (400) pour une route inconnue. */
  function lancer(route, corps, { signal } = {}) {
    const fonction = Object.prototype.hasOwnProperty.call(ROUTES, route) ? ROUTES[route] : null;
    if (!fonction) throw new RequeteInvalide('route inconnue');
    const ctx = { client, modele: modele(), journal, signal, candidatures, offres, memoire, get index() { return lireIndex(); } };
    if (!ctx.modele) throw new ModeleIndisponible('aucun modèle de génération choisi');
    return fonction(corps, ctx);
  }

  return { lancer, journal, index: lireIndex, modeleEmbed, oublierConversation: id => memoire.oublier(String(id || '')) };
}

module.exports = { creerIA, demarrer, codeErreur, RequeteInvalide, ModeleIndisponible, ROUTES: Object.keys(ROUTES) };
