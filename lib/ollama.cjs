'use strict';
const {MODEL_TIERS}=require('./domain.cjs');
const QWEN_CATALOG = Object.freeze([
  {name:'qwen2.5:1.5b',label:'Qwen 2.5 · 1.5B',minRam:4,note:'Compact, faible consommation'},
  {name:'qwen2.5:3b',label:'Qwen 2.5 · 3B',minRam:8,note:'Équilibre vitesse et qualité'},
  {name:'qwen2.5:7b',label:'Qwen 2.5 · 7B',minRam:16,note:'Bon choix pour 16–24 Go de RAM'},
  {name:'qwen2.5:14b',label:'Qwen 2.5 · 14B',minRam:32,note:'Plus exigeant en mémoire'},
  {name:'qwen2.5-coder:3b',label:'Qwen Coder · 3B',minRam:8,note:'Spécialisé programmation'},
  {name:'qwen2.5-coder:7b',label:'Qwen Coder · 7B',minRam:16,note:'Pour les contenus techniques'}
]);
function allowedModel(name){return QWEN_CATALOG.some(x=>x.name===name);}
/** RAM totale : sur macOS la mémoire libre brute exclut la mémoire récupérable. */
function recommendedDownload(totalGb){
  if(!Number.isFinite(totalGb))return null;
  return MODEL_TIERS.filter(x=>totalGb>=x.minRam).at(-1)?.name||null;
}
function parsePullUpdate(line){
  let value;
  try{value=JSON.parse(line);}catch{throw new Error('Flux de téléchargement Ollama invalide.');}
  const total=Number(value.total)||0,completed=Number(value.completed)||0;
  return {status:String(value.status||'Téléchargement…').slice(0,100),percent:total>0?Math.min(100,Math.round(completed*100/total)):null,error:value.error?String(value.error).slice(0,250):''};
}
function explainOllamaError(error=null,status=0,detail=''){
  const msg=String(detail||error?.message||'');
  if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'Ollama met trop de temps à répondre. Vérifie la RAM, ferme les applications lourdes ou essaie un modèle plus petit.';
  if(/memory|ram|allocat|resource|out of memory|requires more/i.test(msg))return 'Mémoire insuffisante pour exécuter ce modèle. Ferme des applications ou choisis Qwen 3B/1.5B dans les paramètres.';
  if(/fetch failed|ECONNREFUSED|connect|network/i.test(msg))return 'Ollama ne répond pas sur cet ordinateur. Lance Ollama, puis réessaie.';
  if(status===404||/model.+not found/i.test(msg))return 'Modèle absent d’Ollama. Installe le modèle recommandé ou choisis un modèle déjà installé.';
  if(status>=400)return `Ollama a renvoyé une erreur (${status})${msg?` : ${msg.slice(0,160)}`:''}.`;
  return `Ollama : ${msg.slice(0,190)||'erreur inconnue'}.`;
}
module.exports={recommendedDownload,parsePullUpdate,explainOllamaError,QWEN_CATALOG,allowedModel};
