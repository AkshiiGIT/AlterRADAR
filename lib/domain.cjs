'use strict';
const crypto = require('node:crypto');

const MODEL_TIERS = Object.freeze([
  { minRam: 4, name: 'qwen2.5:1.5b', minFree: 2.5, label: 'Léger' },
  { minRam: 8, name: 'qwen2.5:3b', minFree: 4, label: 'Équilibré' },
  { minRam: 16, name: 'qwen2.5:7b', minFree: 8, label: 'Performant' },
  { minRam: 32, name: 'qwen2.5:14b', minFree: 16, label: 'Avancé' }
]);

function recommendedModel(totalGb, freeGb = totalGb) {
  if (!Number.isFinite(totalGb) || totalGb < 4) return null;
  // Uniquement une estimation : le GPU, la quantification et les autres processus comptent.
  const eligible = MODEL_TIERS.filter(t => totalGb >= t.minRam && freeGb >= t.minFree);
  return eligible.at(-1)?.name || null;
}

function selectInstalledModel(models, saved, recommended) {
  const names = models.map(x => typeof x === 'string' ? x : x.name).filter(Boolean);
  if (names.includes(saved)) return saved;
  if (names.includes(recommended)) return recommended;
  return names[0] || '';
}

function normalizeModels(payload) {
  if (!payload || !Array.isArray(payload.models)) throw new Error('Réponse inattendue d’Ollama');
  const seen = new Set();
  return payload.models.map(m => {
    const name = typeof m.name === 'string' ? m.name : m.model;
    if (typeof name !== 'string' || !name.trim() || seen.has(name)) return null;
    seen.add(name);
    return {
      name,
      size: Number.isFinite(m.size) ? m.size : 0,
      family: String(m.details?.family || ''),
      parameters: String(m.details?.parameter_size || ''),
      quantization: String(m.details?.quantization_level || '')
    };
  }).filter(Boolean).sort((a,b)=>a.size-b.size || a.name.localeCompare(b.name));
}

function parseBoard(input) {
  let url;
  try { url = new URL(String(input || '').trim()); }
  catch { throw new Error('Saisis une URL complète du tableau de recrutement.'); }
  if (url.protocol !== 'https:') throw new Error('Utilise une URL HTTPS.');
  if (url.username || url.password || url.port) throw new Error('URL non prise en charge.');
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let source, slug;
  if (['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(host)) {
    source = 'Greenhouse'; slug = parts[0];
  } else if (host === 'jobs.lever.co') {
    source = 'Lever'; slug = parts[0];
  } else {
    throw new Error('Source prise en charge : Greenhouse ou Lever uniquement.');
  }
  if (!slug || !/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) throw new Error('Identifiant du tableau invalide.');
  return { source, slug };
}

function relevantJob(job) {
  return require('./contracts.cjs').eligibleContract(job,['alternance']);
}

function scoreJob(job, profile) {
  return require('./matching.cjs').analyzeMatch(job,profile).score;
}

function validateHttpsUrl(input) {
  let url;
  try { url = new URL(String(input || '')); }
  catch { throw new Error('URL invalide.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('URL HTTPS requise.');
  return url.href;
}

function jobId(url) { return crypto.createHash('sha256').update(url).digest('hex').slice(0, 22); }
function clean(value, limit = 250) { return String(value ?? '').trim().slice(0, limit); }

module.exports = { MODEL_TIERS, recommendedModel, selectInstalledModel, normalizeModels, parseBoard, relevantJob, scoreJob, validateHttpsUrl, jobId, clean };
