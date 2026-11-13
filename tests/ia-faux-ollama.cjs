'use strict';
/**
 * Faux Ollama pour les tests de l'assistant IA : aucun modèle réel n'est nécessaire.
 * Il imite l'API native (/api/chat en NDJSON, appels d'outil, /api/embed) avec des
 * réponses déterministes, pour vérifier la plomberie et le contrat, pas la qualité.
 *
 * Usage autonome (pour lancer la suite de conformité du cours sans Ollama) :
 *   node tests/ia-faux-ollama.cjs 11435
 *   OLLAMA_BASE_URL=http://127.0.0.1:11435 npm run ia:serveur
 */
const http = require('node:http');

function creerFauxOllama({ sansEmbed = false, latenceMs = 5, routeurCasse = false } = {}) {
  const installes = new Set(['qwen2.5:3b', ...(sansEmbed ? [] : ['paraphrase-multilingual'])]);
  const appels = [];

  // Les mots-outils sont ignor\u00e9s, comme le fait en pratique un vrai mod\u00e8le d'embedding.
  const VIDES = new Set('quelle quel quels quelles est les des une pour comment dans sur avec que qui sont mon mes ton tes son ses aux par pas plus cette ces faire peut tout'.split(' '));
  const mots = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(m => m.length > 2 && !VIDES.has(m));
  // Embedding « sac de mots » haché : deux textes partageant des mots ont un cosinus positif.
  // 4096 cases : avec 512, « réinitialisation » et « Pérou » tombaient dans la même case et
  // une question hors sujet trouvait une source par pure collision de hachage.
  const DIMENSIONS = 4096;
  function vecteur(texte) {
    const v = new Array(DIMENSIONS).fill(0);
    for (const m of mots(texte)) {
      let h = 0;
      for (const c of m.slice(0, 6)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      v[h % DIMENSIONS] += 1;
    }
    return v;
  }

  function decisionOutil(question) {
    if (/combien|bilan|lesquelles|o[uù] j.en suis|o[uù] en sont/i.test(question)) {
      const statut = /entretien/i.test(question) ? 'entretien' : undefined;
      return { name: 'bilan_candidatures', arguments: statut ? { statut } : {} };
    }
    const chez = /chez\s+([^?]+)/i.exec(question)?.[1] || /(CMD-[\w-]+)/i.exec(question)?.[1] || /([A-Z][\w-]+(?:\s+[A-Z][\w-]+)*)\s*\?/.exec(question)?.[1];
    return chez ? { name: 'chercher_candidature', arguments: { recherche: chez.trim() } } : null;
  }

  // Routeur du chatbot : une catégorie choisie par mots-clés (le vrai modèle, lui, lit la consigne).
  function routeFausse(messages) {
    const brut = /"""\n([\s\S]*?)\n"""/.exec(messages.at(-1)?.content || '')?.[1] || '';
    const t = brut.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const offre = /offre (?:de|chez) ([A-Z][\w ]+?)\s*\??$/.exec(brut)?.[1] || '';
    if (/que sait-on|infos? sur|entreprise/.test(t)) return { categorie: 'entreprise', offre: /de ([A-Z][\w ]+?)\s*\??$/.exec(brut)?.[1] || '' };
    if (/resum|annonce/.test(t)) return { categorie: 'resume_offre', offre };
    if (/ma candidature|mes candidatures|combien|postule|relance/.test(t)) return { categorie: 'candidatures', offre: '' };
    if (/telegram|installer|ollama|alterradar|donnees|ats\b/.test(t)) return { categorie: 'aide_app', offre: '' };
    if (/alternance|stage|cv\b|lettre|react|javascript|entretien|metier|developp|competence|poste/.test(t)) return { categorie: 'conseil', offre: '' };
    return { categorie: 'hors_sujet', offre: '' };
  }

  function texteFinal(messages) {
    const outil = [...messages].reverse().find(m => m.role === 'tool');
    if (outil) {
      const r = JSON.parse(outil.content);
      if (r.erreur) return `Je n'ai pas pu consulter tes candidatures : ${r.erreur}.`;
      if (r.trouve === false) return 'Je ne trouve pas cette candidature dans AlterRADAR.';
      if (r.resultats) { const f = r.resultats[0]; return `Ta candidature chez ${f.entreprise} (${f.poste}) est au statut « ${f.statut} ». Dernière étape : ${f.derniere_etape}.`; }
      if (r.total !== undefined) return `Tu as ${r.total} offres enregistrées. ${Object.entries(r.par_statut).map(([s, n]) => `${s} : ${n}`).join(', ')}.`;
    }
    const systeme = messages[0]?.content || '';
    const user = messages.at(-1)?.content || '';
    if (/sait d'une entreprise/.test(systeme)) return `D'après AlterRADAR : ${(/<donnees entreprise="([^"]+)">/.exec(user) || [])[1]} publie ${(user.match(/^Offre \d/gm) || []).length} offre(s) enregistrée(s).`;
    if (/Ton cadre, et lui seul/.test(systeme)) return `Conseil : appuie-toi sur un projet concret (${messages.length - 2} messages d'historique).`;
    if (/documentation/.test(systeme)) {
      const titre = /titre="([^"]+)"/.exec(user)?.[1] || 'documentation';
      return `D'après la documentation, la réponse se trouve dans la section indiquée. Source : ${titre}`;
    }
    const texte = /"""\n([\s\S]*?)\n"""/.exec(user)?.[1] || user;
    return `Résumé : ${texte.split(/(?<=[.!?])\s/)[0].slice(0, 160)}`;
  }

  const serveur = http.createServer(async (req, res) => {
    let brut = '';
    for await (const c of req) brut += c;
    let corps = {};
    try { corps = brut ? JSON.parse(brut) : {}; } catch { /* corps vide */ }
    appels.push({ chemin: req.url, corps });
    const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };

    if (req.method === 'GET' && req.url === '/api/tags') return json(200, { models: [...installes].map(name => ({ name })) });
    if (!installes.has(corps.model)) return json(404, { error: `model "${corps.model}" not found, try pulling it first` });

    if (req.url === '/api/embed') {
      const entrees = Array.isArray(corps.input) ? corps.input : [corps.input];
      return json(200, { embeddings: entrees.map(vecteur), prompt_eval_count: entrees.join(' ').length >> 2 });
    }
    if (req.url !== '/api/chat') return json(404, { error: 'not found' });

    const messages = corps.messages || [];
    const entree = Math.max(1, JSON.stringify(messages).length >> 2);
    if (!corps.stream && corps.format) {
      const contenu = routeurCasse ? 'pas du json' : JSON.stringify(routeFausse(messages));
      return json(200, { message: { role: 'assistant', content: contenu }, done: true, prompt_eval_count: entree, eval_count: 8 });
    }
    if (!corps.stream) {
      const question = messages.at(-1)?.content || '';
      const appel = corps.tools ? decisionOutil(question) : null;
      const message = appel ? { role: 'assistant', content: '', tool_calls: [{ function: appel }] } : { role: 'assistant', content: 'Bonjour ! Pose-moi une question sur tes candidatures.' };
      return json(200, { message, done: true, prompt_eval_count: entree, eval_count: appel ? 12 : 9 });
    }
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    const morceaux = texteFinal(messages).match(/\S+\s*/g) || [];
    for (const m of morceaux) {
      res.write(JSON.stringify({ message: { role: 'assistant', content: m }, done: false }) + '\n');
      await new Promise(r => setTimeout(r, latenceMs));
    }
    res.end(JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: entree, eval_count: morceaux.length }) + '\n');
  });
  return { serveur, appels };
}

if (require.main === module) {
  const port = Number(process.argv[2] || 11435);
  creerFauxOllama({ sansEmbed: process.env.FAUX_SANS_EMBED === '1' }).serveur.listen(port, '127.0.0.1', () => console.log(`Faux Ollama sur http://127.0.0.1:${port}`));
}

module.exports = { creerFauxOllama };
