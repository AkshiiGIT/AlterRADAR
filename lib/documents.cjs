'use strict';
/**
 * ATS-friendly, single-column layouts for AlterRADAR.
 * All facts come from the source profile / generated content. No fabricated
 * contact details, employers, diplomas or achievements are inserted.
 */
const fs = require('node:fs');

const CV_HEADINGS = [
  /^(?:profil|profil professionnel|resume professionnel|resume|a propos|presentation|objectif professionnel|accroche)$/i,
  /^(?:competences|competences techniques|competences professionnelles|technologies|expertises|savoir-faire|outils et technologies|langages et outils)$/i,
  /^(?:experiences?|experiences? professionnelles?|experiences? et projets|parcours professionnel|experience professionnelle)$/i,
  /^(?:projets|projets personnels|projets academiques|realisations|projets techniques)$/i,
  /^(?:formation|formations|parcours academique|diplomes|etudes|education)$/i,
  /^(?:certifications?|formations complementaires|certificats)$/i,
  /^(?:langues|langues parlees|langues etrangeres)$/i,
  /^(?:centres? d.interet|interets|activites|informations complementaires)$/i,
];
function plain(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1')
    .replace(/^\s*#{1,5}\s+/gm, '').replace(/[ \t]+$/gm, '').trim();
}
function ascii(value){return plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function isHeading(line) {
  const str = plain(line).replace(/\s*:\s*$/, '');
  return str.length < 65 && CV_HEADINGS.some(reg => reg.test(ascii(str)));
}
function isBullet(line){return /^(?:[-•●▪◦]|\d{1,2}[.)])\s+/.test(line.trim());}
function stripBullet(line){return line.trim().replace(/^(?:[-•●▪◦]|\d{1,2}[.)])\s+/, '');}
function safeText(s){return String(s||'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');}
function cleanLines(text){return plain(text).split('\n').map(s => safeText(s.trim()));}
function looksName(line,profile={}){
  const name=plain(profile.name);
  return Boolean(name && ascii(line)===ascii(name));
}
function contactLines(profile={}){
  const arr=[];
  if(plain(profile.email))arr.push(plain(profile.email));
  if(plain(profile.phone))arr.push(plain(profile.phone));
  if(plain(profile.location))arr.push(plain(profile.location));
  return arr;
}
function cvBlocks(text,profile={}) {
  const lines=cleanLines(text);
  const out=[];
  const name=plain(profile.name);
  const first=lines.find(l=>l && !isHeading(l) && !isBullet(l));
  const firstIsName=first && (looksName(first,profile) || (!name && /^[\p{L}'-]+(?:\s+[\p{L}'-]+){1,3}$/u.test(first) && first.length<45));
  const titleName=name || (firstIsName?first:'');
  if(titleName)out.push({type:'name',text:titleName});
  // A job title is descriptive rather than an asserted diploma or experience.
  const headline=plain(profile.roles).split(/[,;\n]/)[0]?.trim();
  if(headline)out.push({type:'subtitle',text:headline});
  const contacts=contactLines(profile);
  if(contacts.length)out.push({type:'contact',text:contacts.join('  ·  ')});
  if(titleName||contacts.length)out.push({type:'gap'});
  let skippedName=false, pendingBlank=false;
  for(const raw of lines){
    if(!raw){pendingBlank=true;continue;}
    if(firstIsName&&!skippedName&&raw===first){skippedName=true;continue;}
    if(name&&looksName(raw,profile)){continue;}
    if(contacts.length && (raw===profile.email||raw===profile.phone||raw===profile.location))continue;
    if(isHeading(raw)){out.push({type:'section',text:raw.replace(/\s*:\s*$/,'')});pendingBlank=false;continue;}
    if(isBullet(raw)){out.push({type:'bullet',text:stripBullet(raw)});pendingBlank=false;continue;}
    // Key–value or course/experience headings can stand out without tables.
    if(/^[^:]{2,54}:\s+\S/.test(raw)&&raw.length<=125){out.push({type:'entry',text:raw});pendingBlank=false;continue;}
    out.push({type:'paragraph',text:raw,spaceBefore:pendingBlank});pendingBlank=false;
  }
  return out;
}
function letterBlocks(text,profile={},job={}){
  const lines=cleanLines(text);
  const out=[];
  const name=plain(profile.name);
  if(name)out.push({type:'name',text:name});
  const contacts=contactLines(profile);
  if(contacts.length)out.push({type:'contact',text:contacts.join('  ·  ')});
  if(name||contacts.length)out.push({type:'gap'});
  // Use a company name only when the offer actually provides one.
  const company=plain(job.company);
  if(company)out.push({type:'recipient',text:company});
  const subject=plain(job.title);
  const seenSubject=lines.some(l=>/^objet\s*:/i.test(l));
  if(subject&&!seenSubject)out.push({type:'subject',text:`Objet : Candidature — ${subject}`});
  let buffer=[],seenGreeting=false;
  function flush(){if(buffer.length){out.push({type:'letterParagraph',text:buffer.join(' ').replace(/\s+/g,' ').trim()});buffer=[];}}
  for(const raw of lines){
    if(!raw){flush();continue;}
    // Prevent repeated identity blocks when model already prints contact headers.
    if(name&&looksName(raw,profile))continue;
    if(contacts.includes(raw))continue;
    if(company && ascii(raw)===ascii(company))continue;
    if(/^objet\s*:/i.test(raw)){flush();out.push({type:'subject',text:raw});continue;}
    if(/^(?:madame|monsieur|madame, monsieur|bonjour)[,!. ]*$/i.test(raw)){
      flush();out.push({type:'salutation',text:raw});seenGreeting=true;continue;
    }
    if(/^(?:je vous prie|cordialement|bien cordialement|dans l.attente)[\s,]/i.test(raw)){
      flush();out.push({type:'closing',text:raw});continue;
    }
    // A one-line signature is visually separated from the final paragraph.
    if(name&&ascii(raw)===ascii(name)){flush();continue;}
    buffer.push(raw);
  }
  flush();
  return out;
}
function layoutBlocks(text,kind,profile={},job={}){
  if(!['cv','letter'].includes(kind))throw new Error('Type de document invalide.');
  if(!plain(text))throw new Error('Le document à exporter est vide.');
  if(String(text).length>55000)throw new Error('Document trop long pour une seule page ; raccourcis le texte avant export.');
  return kind==='cv'?cvBlocks(text,profile):letterBlocks(text,profile,job);
}

/**
 * Les sorties ATS sont toujours préparées pour une UNIQUE page A4. Les
 * paramètres les plus serrés restent lisibles (jamais de police < 9 pt).
 * Quand le texte est trop long, l'export est refusé et demande une révision :
 * il ne doit jamais effacer silencieusement des expériences du candidat.
 */
const PAGE_PRESETS = Object.freeze([
  Object.freeze({id:'standard', font:10.3, line:1.26, margin:51, gap:6.0, sectionGap:12}),
  Object.freeze({id:'compact', font:9.65, line:1.19, margin:43, gap:4.6, sectionGap:9}),
  Object.freeze({id:'dense', font:9.1, line:1.15, margin:39, gap:3.4, sectionGap:7})
]);
function fontFor(block,preset){
  if(block.type==='name')return 17.3;
  if(block.type==='section')return preset.font+.2;
  if(block.type==='subtitle')return preset.font+.8;
  if(block.type==='contact')return preset.font-1;
  if(block.type==='subject')return preset.font+.25;
  return preset.font;
}
function blockGap(block,preset){
  if(block.type==='gap')return 6;
  if(block.type==='name')return 5;
  if(block.type==='subtitle'||block.type==='contact')return 4;
  if(block.type==='section')return preset.sectionGap;
  if(block.type==='letterParagraph')return preset.gap+4;
  if(block.type==='subject'||block.type==='salutation'||block.type==='recipient'||block.type==='closing')return preset.gap+6;
  return block.type==='bullet'?preset.gap*.6:preset.gap;
}
function blockContent(block){
  return (block.type==='bullet'?'•  ':'')+safeText(block.text||'');
}
function roughHeight(block,preset,kind){
  if(block.type==='gap')return 8;
  if(!block.text)return 0;
  const font=fontFor(block,preset);
  const width=595.28-2*preset.margin-(block.type==='bullet'?12:0);
  // Conservez une marge de sécurité pour les mots longs, accents et polices.
  const charsPerLine=Math.max(26,width/(font*.56));
  const paragraphs=Math.max(1,Math.ceil([...blockContent(block)].length/charsPerLine));
  const lineHeight=font*preset.line;
  return paragraphs*lineHeight+blockGap(block,preset)+(block.type==='section'?4:0);
}
function approxDocumentHeight(blocks,preset,kind){
  return blocks.reduce((sum,b)=>sum+roughHeight(b,preset,kind),0);
}
function fitSinglePage(blocks,kind){
  const presets=kind==='cv'?PAGE_PRESETS:PAGE_PRESETS;
  for(const preset of presets){
    const usable=841.89-2*preset.margin-18; // pied de page de sécurité
    // 5% de marge pour les différences de moteur entre Word / LibreOffice.
    if(approxDocumentHeight(blocks,preset,kind)*1.05<=usable)return preset;
  }
  throw new Error(`Le ${kind==='cv'?'CV':'texte de la lettre'} est trop long pour une seule page A4 lisible. Raccourcis les passages secondaires dans l’éditeur, puis régénère le document. Aucun contenu n’a été supprimé automatiquement.`);
}
function layoutPlan(text,kind,profile={},job={}){
  const blocks=layoutBlocks(text,kind,profile,job);
  const preset=fitSinglePage(blocks,kind);
  return {blocks,preset,estimatedHeight:approxDocumentHeight(blocks,preset,kind)};
}
function paragraphChildren(docx,text,opts={}){
  const {TextRun}=docx;
  const str=safeText(text);
  const match=opts.entry && /^([^:]{2,45}:)\s*(.+)$/.exec(str);
  if(match)return [new TextRun({text:match[1]+' ',bold:true}),new TextRun(match[2])];
  return [new TextRun(str)];
}
function asDocxParagraph(docx,block,preset){
  const {Paragraph,TextRun,BorderStyle}=docx;
  const color='252B36',muted='59647A',accent='514A9D';
  // docx utilise des points * 2 pour les tailles de police, des twips pour les espacements.
  const pointSize=fontFor(block,preset);
  const gap=blockGap(block,preset);
  const base={children:paragraphChildren(docx,block.text||'',{entry:block.type==='entry'}),
    spacing:{after:Math.round(gap*20),line:Math.round(pointSize*preset.line*20)},keepTogether:true};
  switch(block.type){
    case 'name':return new Paragraph({...base,children:[new TextRun({text:block.text,bold:true,size:Math.round(pointSize*2),color})],keepNext:true});
    case 'subtitle':return new Paragraph({...base,children:[new TextRun({text:block.text,size:Math.round(pointSize*2),bold:true,color:accent})],keepNext:true});
    case 'contact':return new Paragraph({...base,children:[new TextRun({text:block.text,size:Math.round(pointSize*2),color:muted})],keepNext:true});
    case 'gap':return new Paragraph({text:'',spacing:{after:Math.round(gap*20),line:120}});
    case 'section':return new Paragraph({...base,children:[new TextRun({text:block.text.toUpperCase(),bold:true,size:Math.round(pointSize*2),color:accent})],
      border:{bottom:{color:'CDD3DE',style:BorderStyle.SINGLE,size:4,space:3}},spacing:{before:Math.round(preset.sectionGap*8),after:Math.round(gap*20),line:Math.round(pointSize*preset.line*20)},keepNext:true});
    case 'bullet':return new Paragraph({...base,children:[new TextRun('•  '+block.text)],indent:{left:240,hanging:110}});
    case 'entry':return new Paragraph({...base,spacing:{after:Math.round(gap*20),line:Math.round(pointSize*preset.line*20)}});
    case 'recipient':return new Paragraph({...base,children:[new TextRun({text:block.text,bold:true})]});
    case 'subject':return new Paragraph({...base,children:[new TextRun({text:block.text,bold:true,color})],keepNext:true});
    case 'letterParagraph':return new Paragraph({...base,alignment:'both'});
    default:return new Paragraph(base);
  }
}
async function createDocxBuffer(text,kind,profile={},job={}){
  const docx=require('docx');
  const {Document,Packer}=docx;
  const {blocks,preset}=layoutPlan(text,kind,profile,job);
  const children=blocks.map(b=>asDocxParagraph(docx,b,preset));
  const twip=Math.round(preset.margin*20);
  const document=new Document({
    creator:'AlterRADAR · Akasche MAHINTAN',description:'Document A4 à une page, une colonne, compatible ATS',
    styles:{default:{document:{run:{font:'Aptos',size:Math.round(preset.font*2),color:'252B36'},paragraph:{spacing:{after:Math.round(preset.gap*20),line:Math.round(preset.font*preset.line*20)}}}}},
    sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:twip,bottom:twip,left:twip,right:twip}}},children}]
  });
  return Packer.toBuffer(document);
}
function preferredPdfFont(){
  const candidates=[
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'
  ];
  return candidates.find(p=>fs.existsSync(p))||null;
}
function pdfHeight(doc,blocks,preset){
  let y=preset.margin;
  const maxWidth=doc.page.width-2*preset.margin;
  for(const b of blocks){
    if(b.type==='gap'){y+=8;continue;}
    const content=blockContent(b);
    if(!content)continue;
    const font=fontFor(b,preset);
    doc.fontSize(font);
    y+=doc.heightOfString(content,{width:maxWidth-(b.type==='bullet'?12:0),lineGap:font*(preset.line-1)});
    y+=blockGap(b,preset)+(b.type==='section'?4:0);
  }
  return y;
}
async function createPdfFile(target,text,kind,profile={},job={}){
  const PDFDocument=require('pdfkit');
  const {blocks}=layoutPlan(text,kind,profile,job);
  const accent='#514A9D',ink='#252B36',muted='#59647A';
  // Mesure en mémoire AVANT tout écrit. PDFKit n'ajoutera pas silencieusement
  // de deuxième page : si aucun preset ne passe, l'utilisateur doit condenser.
  const doc=new PDFDocument({size:'A4',margin:0,autoFirstPage:true,bufferPages:true});
  const font=preferredPdfFont();
  if(font)doc.registerFont('AR',font);
  doc.font(font?'AR':'Helvetica');
  let preset=null;
  for(const p of PAGE_PRESETS){if(pdfHeight(doc,blocks,p)<=doc.page.height-p.margin-16){preset=p;break;}}
  if(!preset){doc.end();throw new Error(`Le ${kind==='cv'?'CV':'texte de la lettre'} ne tient pas sur une page A4. Condense le texte avant l’export ; aucune information ne sera supprimée automatiquement.`);}
  doc.y=preset.margin;
  const width=doc.page.width-preset.margin*2;
  const stream=fs.createWriteStream(target);
  return new Promise((resolve,reject)=>{
    doc.pipe(stream);
    for(const b of blocks){
      if(b.type==='gap'){doc.y+=8;continue;}
      const t=blockContent(b);if(!t)continue;
      const fontSize=fontFor(b,preset);
      doc.fontSize(fontSize).fillColor(b.type==='section'||b.type==='subtitle'?accent:b.type==='contact'?muted:ink);
      if(b.type==='section'){
        doc.text(t.toUpperCase(),preset.margin,doc.y,{width,lineGap:fontSize*(preset.line-1)});
        doc.strokeColor('#CDD3DE').lineWidth(.6).moveTo(preset.margin,doc.y+2).lineTo(doc.page.width-preset.margin,doc.y+2).stroke();doc.y+=4;
      }else{
        doc.text(t,preset.margin,doc.y,{width:width-(b.type==='bullet'?12:0),lineGap:fontSize*(preset.line-1),align:b.type==='letterParagraph'?'justify':'left'});
      }
      doc.y+=blockGap(b,preset);
    }
    if(doc.bufferedPageRange().count!==1){doc.end();stream.destroy();reject(new Error('Échec contrôle de pagination PDF : plus d’une page.'));return;}
    doc.end();stream.on('finish',resolve);stream.on('error',reject);
  });
}
module.exports={plain,isHeading,layoutBlocks,cvBlocks,letterBlocks,layoutPlan,fitSinglePage,approxDocumentHeight,createDocxBuffer,createPdfFile};
