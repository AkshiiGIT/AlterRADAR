'use strict';
/**
 * Client du modèle local (Ollama, API native /api/chat et /api/embed).
 *
 * Règle 3 du contrat : tout appel au modèle a un timeout explicite. En cas
 * d'échec (Ollama éteint, modèle absent, délai dépassé), on lève
 * ModeleIndisponible : la route le traduit en 503, ou bascule sur un repli.
 *
 * Pourquoi l'API native plutôt que /v1/chat/completions (compatible OpenAI) ?
 * Le reste d'AlterRADAR l'utilise déjà, et elle permet de régler `num_ctx`
 * (taille du contexte) : indispensable pour résumer une annonce longue.
 */

const DELAI_APPEL_MS = 60_000;  // appel classique (boucle d'appel d'outil, embeddings)
const DELAI_FLUX_MS = 180_000;  // flux complet : un long résumé sur un petit ordinateur

class ModeleIndisponible extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ModeleIndisponible';
    this.status = status; // code HTTP renvoyé par Ollama (404 = modèle absent), 0 sinon
  }
}

/** Combine l'annulation demandée par l'appelant et le timeout explicite. */
function signalAvecDelai(signal, ms) {
  const delai = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, delai]) : delai;
}

/**
 * Ollama omet parfois prompt_eval_count quand le prompt est déjà en cache.
 * On estime alors grossièrement (≈ 4 caractères par token) plutôt que d'afficher 0.
 */
function estimerTokens(messages) {
  const caracteres = messages.reduce((n, m) => n + String(m.content || '').length, 0);
  return Math.max(1, Math.round(caracteres / 4));
}

function creerClient({ base = 'http://127.0.0.1:11434', delaiAppelMs = DELAI_APPEL_MS, delaiFluxMs = DELAI_FLUX_MS, fetch: fetchImpl = globalThis.fetch } = {}) {
  const racine = String(base).replace(/\/+$/, '');

  async function poster(chemin, corps, signal, ms) {
    let reponse;
    try {
      reponse = await fetchImpl(`${racine}${chemin}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corps),
        signal: signalAvecDelai(signal, ms)
      });
    } catch (erreur) {
      const motif = erreur?.name === 'TimeoutError' ? `délai de ${ms / 1000} s dépassé` : (erreur?.message || 'connexion impossible');
      throw new ModeleIndisponible(`Ollama injoignable : ${motif}`);
    }
    if (!reponse.ok) {
      let detail = '';
      try { detail = String((await reponse.json())?.error || ''); } catch { /* corps illisible */ }
      throw new ModeleIndisponible(`Ollama a répondu ${reponse.status}${detail ? ` : ${detail.slice(0, 200)}` : ''}`, reponse.status);
    }
    return reponse;
  }

  /**
   * Appel classique, sans streaming. Sert à la boucle d'appel d'outil.
   * Renvoie { message, usage: { entree, sortie } }.
   */
  async function appeler({ modele, messages, outils, options = {}, signal }) {
    const corps = { model: modele, messages, stream: false, options: { temperature: 0, ...options } };
    if (outils?.length) corps.tools = outils;
    const reponse = await poster('/api/chat', corps, signal, delaiAppelMs);
    let donnees;
    try { donnees = await reponse.json(); } catch { throw new ModeleIndisponible('Réponse illisible du modèle'); }
    if (!donnees?.message) throw new ModeleIndisponible('Réponse du modèle sans message');
    return {
      message: donnees.message,
      usage: { entree: donnees.prompt_eval_count || estimerTokens(messages), sortie: donnees.eval_count || 0 }
    };
  }

  /**
   * Appel en streaming. Produit des couples [genre, valeur] :
   *   ['delta', 'un morceau de texte']
   *   ['usage', { entree, sortie }]      (en dernier)
   * Ollama renvoie une ligne JSON par fragment (NDJSON), la dernière porte done: true.
   */
  async function* streamer({ modele, messages, options = {}, signal }) {
    const corps = { model: modele, messages, stream: true, options: { temperature: 0.3, ...options } };
    const reponse = await poster('/api/chat', corps, signal, delaiFluxMs);
    const decodeur = new TextDecoder();
    let tampon = '';
    try {
      for await (const octets of reponse.body) {
        tampon += decodeur.decode(octets, { stream: true });
        const lignes = tampon.split('\n');
        tampon = lignes.pop();
        for (const ligne of lignes) {
          if (!ligne.trim()) continue;
          let bloc;
          try { bloc = JSON.parse(ligne); } catch { throw new ModeleIndisponible('Flux du modèle illisible'); }
          if (bloc.error) throw new ModeleIndisponible(`Erreur du modèle : ${String(bloc.error).slice(0, 200)}`);
          const morceau = bloc.message?.content;
          if (morceau) yield ['delta', morceau];
          if (bloc.done) {
            yield ['usage', { entree: bloc.prompt_eval_count || estimerTokens(messages), sortie: bloc.eval_count || 0 }];
            return;
          }
        }
      }
    } catch (erreur) {
      if (erreur instanceof ModeleIndisponible) throw erreur;
      const motif = erreur?.name === 'TimeoutError' ? 'délai dépassé' : (erreur?.message || 'flux interrompu');
      throw new ModeleIndisponible(`Flux interrompu : ${motif}`);
    }
    throw new ModeleIndisponible('Flux terminé sans évènement final');
  }

  /** Vectorise une liste de textes. Renvoie { vecteurs, entree }. */
  async function plonger({ modele, textes, signal }) {
    const reponse = await poster('/api/embed', { model: modele, input: textes }, signal, delaiAppelMs);
    let donnees;
    try { donnees = await reponse.json(); } catch { throw new ModeleIndisponible('Embeddings illisibles'); }
    if (!Array.isArray(donnees?.embeddings) || donnees.embeddings.length !== textes.length) {
      throw new ModeleIndisponible('Embeddings incomplets');
    }
    return { vecteurs: donnees.embeddings, entree: donnees.prompt_eval_count || 0 };
  }

  return { appeler, streamer, plonger };
}

module.exports = { creerClient, ModeleIndisponible, estimerTokens, DELAI_APPEL_MS, DELAI_FLUX_MS };
