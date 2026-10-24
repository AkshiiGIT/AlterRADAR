'use strict';
/** Pure client-side sorting: no network calls or guessed timestamps/distances. */
(function(root){
  const goodDate=v=>{const t=Date.parse(String(v||''));return Number.isFinite(t)?t:null;};
  function sortJobs(jobs,mode='score',distances={}){
    const score=j=>Number.isFinite(Number(j.score))?Number(j.score):0;
    return [...jobs].sort((a,b)=>{
      if(mode==='recent'){
        // Tri uniquement sur la date de publication prouvée. Les inconnues en dernier.
        const ad=goodDate(a.publishedAt);
        const bd=goodDate(b.publishedAt);
        if(ad===null&&bd!==null)return 1;
        if(ad!==null&&bd===null)return -1;
        if(ad!==bd)return (bd||0)-(ad||0);
      }
      if(mode==='distance'){
        const ad=distances[a.id],bd=distances[b.id];
        const ak=typeof ad==='number'&&Number.isFinite(ad)&&ad>=0;
        const bk=typeof bd==='number'&&Number.isFinite(bd)&&bd>=0;
        if(ak!==bk)return ak?-1:1;
        if(ak&&ad!==bd)return ad-bd;
      }
      return score(b)-score(a) || String(a.id||'').localeCompare(String(b.id||''));
    });
  }
  const api=Object.freeze({sortJobs});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.AlterRadarJobSort=api;
})(typeof window!=='undefined'?window:null);
