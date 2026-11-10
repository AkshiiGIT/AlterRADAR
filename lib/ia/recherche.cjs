'use strict';
/**
 * Fonction 3, première partie (séances 12 et 13) : l'index de recherche.
 * Retrouver les extraits de la documentation d'AlterRADAR les plus proches
 * d'une question, SANS modèle de génération.
 *
 *   1. découper la documentation en morceaux (sur les titres ## et ###)
 *   2. vectoriser chaque morceau une seule fois (embeddings)
 *   3. comparer la question aux morceaux par similarité cosinus
 *
 * Repli (règle 3) : si le modèle d'embedding est absent ou ne répond pas, on
 * bascule sur une recherche par mots-clés (TF-IDF), elle aussi notée en cosinus.
 */
const fs = require('node:fs');
const path = require('node:path');

// La documentation publique du dépôt sert de corpus : l'assistant reste à jour
// quand la documentation change. PUBLICATION_GITHUB.md (procédure mainteneur) est exclu.
const CORPUS = Object.freeze([
  { fichier: 'README.md', titre: 'AlterRADAR' },
  { fichier: 'INSTALLATION.md', titre: 'Installation' },
  { fichier: 'docs/PRIVACY.md', titre: 'Confidentialité' },
  { fichier: 'docs/TELEGRAM.md', titre: 'Telegram' },
  { fichier: 'docs/ATS.md', titre: 'Logiciels de recrutement (ATS)' }
]);
const SECTIONS_IGNOREES = new Set(['Créateur', 'Licence', 'Contribuer']);

// paraphrase-multilingual ne lit qu'environ 128 tokens par texte : au-delà, il tronque.
// Des morceaux courts (≈ 900 caractères, ≈ 220 tokens) gardent donc l'essentiel de chaque section.
const TAILLE_MAX = 900;
const TAILLE_MIN = 80;

// En dessous de ces scores, aucun extrait ne parle de la question : on refuse sans appeler le modèle.
const SEUIL_SEMANTIQUE = Number(process.env.IA_SEUIL || 0.25);
const SEUIL_LEXICAL = 0.08;

/** Markdown et HTML → texte lisible (badges, images et balises retirés, tableaux aplatis). */
function nettoyerMarkdown(texte) {
  return String(texte || '')
    .replace(/<[^>]+>/g, ' ')                                   // balises HTML
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')          // badges
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                       // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                    // liens : on garde le texte
    .replace(/^>\s*\[!\w+\]\s*$/gm, '')                         // encadrés GitHub > [!NOTE]
    .replace(/^>\s?/gm, '')
    .replace(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, '') // ligne de séparation des tableaux
    .replace(/^\|(.*)\|\s*$/gm, (_l, cellules) => cellules.split('|').map(c => c.trim()).filter(Boolean).join(' : '))
    .replace(/\*\*|__|`/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Regroupe des pièces (lignes ou phrases) en blocs d'au plus TAILLE_MAX caractères, sans rien perdre. */
function regrouper(pieces, separateur) {
  const blocs = [];
  let bloc = '';
  for (const piece of pieces) {
    if (bloc && bloc.length + separateur.length + piece.length > TAILLE_MAX) { blocs.push(bloc); bloc = ''; }
    bloc = bloc ? `${bloc}${separateur}${piece}` : piece;
  }
  return bloc ? [...blocs, bloc] : blocs;
}

/** Une ligne trop longue est coupée entre deux phrases ; une phrase trop longue, à la limite. */
function couperLigne(ligne) {
  if (ligne.length <= TAILLE_MAX) return [ligne];
  const phrases = ligne.split(/(?<=[.!?…])\s+/).flatMap(p => p.length <= TAILLE_MAX ? [p] : p.match(new RegExp(`[\\s\\S]{1,${TAILLE_MAX}}`, 'g')));
  return regrouper(phrases, ' ');
}

/** Paragraphes ; un paragraphe trop long (liste, tableau, pavé) est regroupé ligne par ligne, puis phrase par phrase. */
function unites(texte) {
  return texte.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .flatMap(p => (p.length <= TAILLE_MAX ? [p] : regrouper(p.split('\n').flatMap(couperLigne), '\n')));
}

/** Coupe un texte trop long en fenêtres d'au plus TAILLE_MAX caractères, avec une unité de recouvrement. */
function fenetres(texte) {
  if (texte.length <= TAILLE_MAX) return [texte];
  const sorties = [];
  let courant = [];
  for (const u of unites(texte)) {
    if (courant.length && [...courant, u].join('\n\n').length > TAILLE_MAX) {
      sorties.push(courant.join('\n\n'));
      const recouvrement = courant.at(-1); // le dernier paragraphe est répété dans la fenêtre suivante
      courant = recouvrement.length + u.length + 2 <= TAILLE_MAX ? [recouvrement] : [];
    }
    courant.push(u);
  }
  if (courant.length) sorties.push(courant.join('\n\n'));
  // Une dernière fenêtre trop courte (une légende, une ligne isolée) rejoint la précédente si le
  // total reste sous la limite ; sinon elle est écartée, comme une section trop courte.
  if (sorties.length > 1 && sorties.at(-1).length < TAILLE_MIN) {
    const reste = sorties.pop();
    if (sorties.at(-1).length + 2 + reste.length <= TAILLE_MAX) sorties[sorties.length - 1] += `\n\n${reste}`;
  }
  return sorties;
}

/**
 * Découpe un document en morceaux : [{ titre, texte }].
 * Découper sur la structure (les titres) vaut mieux que découper sur la longueur.
 */
function decouper(titreDocument, markdown) {
  const sections = [];
  let titre = titreDocument;
  let lignes = [];
  const pousser = () => { if (lignes.length) sections.push({ titre, brut: lignes.join('\n') }); lignes = []; };
  for (const ligne of String(markdown || '').split(/\r?\n/)) {
    const entete = /^\s*(#{1,3})\s+(.+?)\s*#*\s*$/.exec(ligne);
    if (entete && entete[1].length >= 2) {
      pousser();
      titre = `${titreDocument} › ${nettoyerMarkdown(entete[2])}`;
    } else if (!entete) lignes.push(ligne);
  }
  pousser();
  const morceaux = [];
  for (const { titre: t, brut } of sections) {
    if (SECTIONS_IGNOREES.has(t.split(' › ').at(-1))) continue;
    const propre = nettoyerMarkdown(brut);
    if (propre.length < TAILLE_MIN) continue; // trop court pour porter du sens
    fenetres(propre).forEach((texte, i, tout) => morceaux.push({ titre: tout.length > 1 ? `${t} (${i + 1}/${tout.length})` : t, texte }));
  }
  return morceaux;
}

function chargerCorpus(racine) {
  return CORPUS.flatMap(({ fichier, titre }) => {
    let contenu = '';
    try { contenu = fs.readFileSync(path.join(racine, fichier), 'utf8'); } catch { return []; }
    return decouper(titre, contenu);
  });
}

/** Similarité cosinus : produit scalaire divisé par le produit des normes. Entre -1 et 1. */
function cosinus(a, b) {
  let scalaire = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { scalaire += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return Math.max(-1, Math.min(1, scalaire / Math.sqrt(na * nb)));
}

/** Les k morceaux les plus proches, du plus proche au moins proche : [{ titre, texte, score }]. */
function chercher(vecteurQuestion, vecteurs, morceaux, k = 3) {
  return vecteurs
    .map((v, i) => ({ ...morceaux[i], score: cosinus(vecteurQuestion, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// ----- Repli lexical : TF-IDF, sans aucun modèle -------------------------------------

const MOTS_VIDES = new Set(('a au aux avec ce ces cette dans de des du elle en est et il je la le les leur lui ma mais me mes mon ne nous on ou par pas pour qu que qui sa se ses son sur ta te tes ton tu un une vos votre vous y '
  + 'comment quoi quel quelle quels quelles est-ce faire fait peut peux puis dois doit faut il-faut ai as avoir etre suis sont alterradar').split(/\s+/));

function motsCles(texte) {
  return String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(m => m.length > 1 && !MOTS_VIDES.has(m))
    .map(m => (m.length > 4 ? m.replace(/(s|x)$/, '') : m)); // pluriels simples
}

function creerIndexLexical(morceaux) {
  // Le titre compte double : « Telegram (2/5) » parle de Telegram plus sûrement qu'une simple mention.
  const documents = morceaux.map(m => motsCles(`${m.titre} ${m.titre} ${m.texte}`));
  const frequenceDoc = new Map();
  for (const mots of documents) for (const m of new Set(mots)) frequenceDoc.set(m, (frequenceDoc.get(m) || 0) + 1);
  const idf = m => Math.log(1 + morceaux.length / (frequenceDoc.get(m) || 0.5));
  const vecteur = mots => {
    const v = new Map();
    for (const m of mots) v.set(m, (v.get(m) || 0) + idf(m));
    return v;
  };
  const vecteurs = documents.map(vecteur);
  const cos = (a, b) => {
    let s = 0, na = 0, nb = 0;
    for (const [m, x] of a) { na += x * x; if (b.has(m)) s += x * b.get(m); }
    for (const x of b.values()) nb += x * x;
    return na && nb ? s / Math.sqrt(na * nb) : 0;
  };
  return question => {
    const q = vecteur(motsCles(question));
    return vecteurs.map((v, i) => ({ ...morceaux[i], score: cos(q, v) })).sort((a, b) => b.score - a.score);
  };
}

/**
 * L'index complet. Les vecteurs du corpus sont calculés une seule fois puis gardés
 * en mémoire : vectoriser toute la documentation à chaque question serait très lent.
 */
function creerIndex({ client, modeleEmbed, morceaux, journal }) {
  const lexical = creerIndexLexical(morceaux);
  let vecteursEnCours = null;

  function indexer(signal) {
    if (!vecteursEnCours) {
      const debut = performance.now();
      vecteursEnCours = client.plonger({ modele: modeleEmbed, textes: morceaux.map(m => `${m.titre}\n${m.texte}`), signal })
        .then(({ vecteurs, entree }) => {
          journal?.noter({ route: 'documents/index', modele: modeleEmbed, entree, ms: performance.now() - debut, issue: `${vecteurs.length} morceaux vectorisés` });
          return vecteurs;
        })
        .catch(erreur => { vecteursEnCours = null; throw erreur; }); // on retentera à la prochaine question
    }
    return vecteursEnCours;
  }

  /** Renvoie { mode, seuil, resultats } ; ne lève jamais : sans embeddings, on passe en lexical. */
  async function rechercher(question, { k = 3, signal } = {}) {
    try {
      const vecteurs = await indexer(signal);
      const debut = performance.now();
      const { vecteurs: [vq], entree } = await client.plonger({ modele: modeleEmbed, textes: [question], signal });
      journal?.noter({ route: 'documents/question', modele: modeleEmbed, entree, ms: performance.now() - debut });
      return { mode: 'semantique', seuil: SEUIL_SEMANTIQUE, resultats: chercher(vq, vecteurs, morceaux, k) };
    } catch (erreur) {
      if (signal?.aborted) throw erreur;
      journal?.noter({ route: 'documents/question', modele: modeleEmbed, issue: `repli lexical : ${erreur.message}` });
      return { mode: 'lexical', seuil: SEUIL_LEXICAL, resultats: lexical(question).slice(0, k) };
    }
  }

  return { morceaux, indexer, rechercher };
}

module.exports = { CORPUS, nettoyerMarkdown, decouper, chargerCorpus, cosinus, chercher, creerIndexLexical, creerIndex, motsCles, SEUIL_SEMANTIQUE, SEUIL_LEXICAL, TAILLE_MAX };
