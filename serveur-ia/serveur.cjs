#!/usr/bin/env node
'use strict';
/**
 * Serveur HTTP de l'assistant IA d'AlterRADAR, conforme au contrat de route du
 * cours « Les Fondamentaux de l'IA » (3IW, app/CONTRAT.md). Aucune dépendance npm.
 *
 *   POST /api/resumer    { "texte": "...", "ton": "neutre" | "direct" }
 *   POST /api/assistant  { "question": "..." }
 *   POST /api/documents  { "question": "..." }
 *
 * Réponse nominale : 200, text/event-stream, un évènement « data: {...} » par fragment,
 * le dernier portant { done: true, usage: { entree, sortie, ms } }.
 * Erreurs : JSON classique (400 entrée invalide, 503 modèle indisponible), avant le flux.
 *
 * Lancer :  npm run ia:serveur          (http://127.0.0.1:3000)
 * Réglages : PORT, OLLAMA_BASE_URL, MODEL_BASE, MODEL_EMBED, DELAI_MODELE (s),
 *            ALTERRADAR_DONNEES (chemin d'un radar-data.json ; sinon données de démo),
 *            FRONT_DIR (dossier d'un front statique à servir, ex. le front du cours).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { creerIA, demarrer, codeErreur } = require('../lib/ia/index.cjs');
const { depuisEtatAlterRadar } = require('../lib/ia/assistant.cjs');

const PORT = Number(process.env.PORT || 3000);
const HOTE = process.env.HOTE || '127.0.0.1';
const DELAI_MS = Number(process.env.DELAI_MODELE || 60) * 1000;
const DONNEES = process.env.ALTERRADAR_DONNEES || path.join(__dirname, 'candidatures-demo.json');
const FRONT = process.env.FRONT_DIR ? path.resolve(process.env.FRONT_DIR) : '';
const CORPS_MAX = 256 * 1024; // 20 000 caractères accentués, échappés en JSON, tiennent largement

function lireCandidatures() {
  try { return depuisEtatAlterRadar(JSON.parse(fs.readFileSync(DONNEES, 'utf8'))); }
  catch { return []; }
}

function creerServeur(ia) {
  function envoyerJson(res, code, objet) {
    const corps = JSON.stringify(objet);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(corps) });
    res.end(corps);
  }

  async function lireCorps(req) {
    const morceaux = [];
    let taille = 0;
    for await (const morceau of req) {
      taille += morceau.length;
      if (taille > CORPS_MAX) return { trop: true };
      morceaux.push(morceau);
    }
    const brut = Buffer.concat(morceaux).toString('utf8');
    if (!brut.trim()) return {};
    try {
      const corps = JSON.parse(brut);
      return corps && typeof corps === 'object' && !Array.isArray(corps) ? corps : { illisible: true };
    } catch { return { illisible: true }; }
  }

  const sse = evenement => `data: ${JSON.stringify(evenement)}\n\n`;

  async function routeIA(req, res, route) {
    const corps = await lireCorps(req);
    if (corps.trop || corps.illisible) {
      return envoyerJson(res, 400, { erreur: route === 'resumer' ? 'texte invalide' : 'question invalide' });
    }
    // Si le client raccroche, on interrompt aussi l'appel au modèle.
    const annulation = new AbortController();
    res.on('close', () => { if (!res.writableEnded) annulation.abort(); });

    // Le premier évènement est consommé AVANT d'ouvrir le flux : une entrée invalide
    // ou un modèle éteint donnent encore un vrai 400 ou 503 en JSON.
    let flux;
    try { flux = await demarrer(ia.lancer(route, corps, { signal: annulation.signal })); }
    catch (erreur) {
      const { code, erreur: message } = codeErreur(erreur);
      if (code >= 500) console.error(`[ia] ${route} : ${erreur.message}`);
      return envoyerJson(res, code, { erreur: message });
    }

    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    if (flux.premier) res.write(sse(flux.premier));
    try {
      for await (const evenement of flux.suite) res.write(sse(evenement));
    } catch (erreur) {
      // Le flux est déjà ouvert : on ne peut que le clore proprement.
      console.error(`[ia] ${route} interrompu en cours de flux : ${erreur.message}`);
    }
    res.end();
  }

  async function servirFichier(req, res) {
    const demande = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!FRONT) {
      const page = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>AlterRADAR · serveur IA</title>
<body style="font:15px/1.5 system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1>AlterRADAR · serveur IA</h1><p>Routes disponibles (POST, réponses en SSE) :</p>
<ul><li><code>/api/resumer</code> { texte, ton }</li><li><code>/api/assistant</code> { question }</li><li><code>/api/documents</code> { question }</li></ul>
<p>Pour servir un front statique : <code>FRONT_DIR=chemin/vers/front npm run ia:serveur</code>.</p></body></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    const cible = path.resolve(FRONT, demande === '/' ? 'index.html' : `.${demande}`);
    if (cible !== FRONT && !cible.startsWith(FRONT + path.sep)) return envoyerJson(res, 403, { erreur: 'chemin interdit' });
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
    fs.readFile(cible, (erreur, contenu) => {
      if (erreur) return envoyerJson(res, 404, { erreur: 'introuvable' });
      res.writeHead(200, { 'Content-Type': types[path.extname(cible)] || 'application/octet-stream' });
      res.end(contenu);
    });
  }

  return http.createServer(async (req, res) => {
    const chemin = new URL(req.url, 'http://x').pathname;
    const route = /^\/api\/(resumer|assistant|documents)$/.exec(chemin)?.[1];
    try {
      if (route && req.method === 'POST') return await routeIA(req, res, route);
      if (route || chemin.startsWith('/api/')) return envoyerJson(res, route ? 405 : 404, { erreur: route ? 'méthode non autorisée' : 'route inconnue' });
      if (req.method === 'GET') return await servirFichier(req, res);
      return envoyerJson(res, 404, { erreur: 'route inconnue' });
    } catch (erreur) {
      // Jamais de trace d'exécution ni d'adresse du modèle vers le client (règle 5).
      console.error(`[erreur] ${erreur.stack || erreur}`);
      if (!res.headersSent) envoyerJson(res, 500, { erreur: 'erreur interne' });
      else res.end();
    }
  });
}

function configurationParDefaut() {
  return creerIA({
    base: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    modele: () => process.env.MODEL_BASE || 'qwen2.5:3b',
    modeleEmbed: process.env.MODEL_EMBED || 'paraphrase-multilingual',
    candidatures: lireCandidatures,
    racine: path.join(__dirname, '..'),
    delaiAppelMs: DELAI_MS,
    delaiFluxMs: Math.max(DELAI_MS, 120_000)
  });
}

if (require.main === module) {
  const serveur = creerServeur(configurationParDefaut());
  serveur.listen(PORT, HOTE, () => {
    console.log(`Serveur IA AlterRADAR : http://${HOTE === '0.0.0.0' ? 'localhost' : HOTE}:${PORT}`);
    console.log(`Candidatures : ${process.env.ALTERRADAR_DONNEES ? DONNEES : 'données de démonstration'}`);
  });
}

module.exports = { creerServeur };
