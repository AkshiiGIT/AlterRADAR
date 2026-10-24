'use strict';
/** Live, opt-in check of public read-only sources. Never sends a CV or API token. */
const {SOURCES,DEFAULT_ENABLED,fetchProvider}=require('../lib/sources.cjs');
async function main(){
  console.log('AlterRADAR - diagnostic LIVE des 7 flux sans identifiants.');
  console.log('Ce test mesure la connectivité et le format, PAS le nombre de candidatures compatibles.');
  const results=[];
  for(const id of DEFAULT_ENABLED){
    const source=SOURCES.find(s=>s.id===id);const start=Date.now();
    try{
      const jobs=await fetchProvider(id,{profile:{},searchTypes:['alternance']});
      const distinct=new Set(jobs.map(j=>j.url)).size;
      results.push({source:source.name,status:'OK',annonces:jobs.length,uniques:distinct,ms:Date.now()-start});
    }catch(e){results.push({source:source.name,status:'ERREUR',annonces:0,uniques:0,ms:Date.now()-start,error:String(e.message).slice(0,130)});}
  }
  console.table(results);
  console.log('Les API françaises France Travail, Adzuna, Jooble et La Bonne Alternance nécessitent des clés individuelles : non testées ici.');
  console.log('Les 30 ATS désignent des détections d’URL ; seuls certains ont des connecteurs de découverte et aucun scraping de formulaires privés.');
  if(results.some(r=>r.status==='ERREUR'))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
