#!/usr/bin/env node
'use strict';
/**
 * Tester la recherche seule, SANS modèle de génération (comme s13_index du cours).
 *
 *   npm run ia:chercher -- "comment activer les alertes Telegram ?"
 *   npm run ia:chercher -- "quelle est la capitale du Pérou ?"
 *
 * Sert aussi à calibrer le seuil de refus : une question hors sujet doit avoir un
 * meilleur score SOUS le seuil, une vraie question AU-DESSUS. Seuil réglable : IA_SEUIL=0.3
 */
const path = require('node:path');
const { creerClient } = require('../lib/ia/modele.cjs');
const { chargerCorpus, creerIndex } = require('../lib/ia/recherche.cjs');

async function main() {
  const question = process.argv.slice(2).join(' ').trim() || 'comment activer les alertes Telegram ?';
  const client = creerClient({ base: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434' });
  const morceaux = chargerCorpus(path.join(__dirname, '..'));
  const index = creerIndex({ client, modeleEmbed: process.env.MODEL_EMBED || 'paraphrase-multilingual', morceaux, journal: { noter: l => console.log(`  [${l.route}] ${l.issue} (${Math.round(l.ms)} ms)`) } });
  console.log(`${morceaux.length} morceaux dans la documentation\n`);
  const { mode, seuil, resultats } = await index.rechercher(question, { k: 5 });
  console.log(`\nRecherche ${mode}, seuil de refus ${seuil} — « ${question} »\n`);
  for (const r of resultats) {
    console.log(`  ${r.score.toFixed(3)}  ${r.score < seuil ? '(sous le seuil) ' : ''}${r.titre}`);
    console.log(`         ${r.texte.slice(0, 90).replace(/\n/g, ' ')}…`);
  }
  console.log(resultats[0]?.score >= seuil ? '\n→ le modèle recevra ces extraits.' : '\n→ refus sans appeler le modèle : rien d’assez proche dans la documentation.');
}

main().catch(erreur => { console.error(erreur.message); process.exit(1); });
