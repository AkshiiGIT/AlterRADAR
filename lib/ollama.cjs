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
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Flux de téléchargement Ollama invalide.');
  const total=Number(value.total),completed=Number(value.completed);
  const valid=Number.isFinite(total)&&total>0&&Number.isFinite(completed)&&completed>=0;
  return {
    status:String(value.status||'Téléchargement…').slice(0,120),
    percent:valid?Math.max(0,Math.min(100,Math.round(completed*100/total))):null,
    // Ollama reports the current layer/blob, not a guaranteed whole-model total.
    completed:valid?Math.min(completed,total):null,
    total:valid?total:null,
    error:value.error?String(value.error).slice(0,250):''
  };
}
/** Per-layer throughput: reset whenever Ollama switches blob or restarts its count. */
function createPullTracker(){
  let previous=null, speed=0;
  return (update,at=Date.now())=>{
    const {completed,total,status}=update;
    if(!(Number.isFinite(completed)&&Number.isFinite(total)&&total>0)){
      previous=null;speed=0;
      return {...update,speedBytesPerSecond:null,etaSeconds:null};
    }
    const sameLayer=previous&&previous.total===total&&previous.status===status&&completed>=previous.completed;
    if(!sameLayer){speed=0;previous={completed,total,status,at};}
    else{
      const seconds=(at-previous.at)/1000;
      if(seconds>=0.3&&completed>previous.completed){
        const instant=(completed-previous.completed)/seconds;
        // Ignore nonsensical speeds from malformed responses/clock anomalies.
        if(Number.isFinite(instant)&&instant>0&&instant<10**11)speed=speed>0?(.35*instant+.65*speed):instant;
        previous={completed,total,status,at};
      }else if(seconds>=0.3){previous={completed,total,status,at};}
    }
    const eta=speed>0&&total>completed?Math.ceil((total-completed)/speed):null;
    return {...update,speedBytesPerSecond:speed>0?Math.round(speed):null,etaSeconds:eta&&eta<7*24*3600?eta:null};
  };
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
module.exports={recommendedDownload,parsePullUpdate,createPullTracker,explainOllamaError,QWEN_CATALOG,allowedModel};
