'use strict';
/** Bound memory consumption before decoding untrusted local images. */
const LIMIT_INPUT_BYTES=32*1024*1024;
const LIMIT_SAVED_BYTES=8*1024*1024;
function imageKind(b){
  if(b.length>=8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {ext:'png',mime:'image/png'};
  if(b.length>=3 && b[0]===255 && b[1]===216 && b[2]===255)return {ext:'jpg',mime:'image/jpeg'};
  if(b.length>=12 && b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return {ext:'webp',mime:'image/webp'};
  return null;
}
function prepareWallpaper(bytes,nativeImage){
  if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>LIMIT_INPUT_BYTES)throw new Error('Image trop volumineuse (32 Mo maximum avant optimisation).');
  const detected=imageKind(bytes);
  if(!detected)throw new Error('Fichier non reconnu : importe une vraie image PNG, JPG ou WebP.');
  if(bytes.length<=LIMIT_SAVED_BYTES)return {bytes,kind:detected,optimized:false};
  // Convert any format decodable by this Electron installation to a bounded JPEG.
  // Some Electron builds cannot decode WebP: give an explicit fallback in that case.
  if(!nativeImage||typeof nativeImage.createFromBuffer!=='function')throw new Error('Optimisation de l’image indisponible.');
  let img;
  try { img=nativeImage.createFromBuffer(bytes); } catch { /* unsupported codec */ }
  if(!img||img.isEmpty())throw new Error(detected.ext==='webp'
    ? 'WebP impossible à optimiser sur cette machine : convertis-le en JPG puis recommence.'
    : 'Cette image ne peut pas être décodée : essaie de la réexporter en JPG.');
  const size=img.getSize();
  if(!size.width||!size.height||size.width*size.height>45_000_000)throw new Error('Dimensions trop importantes (45 mégapixels maximum).');
  let max=2560;
  for(let i=0;i<5;i++){
    const ratio=Math.min(1,max/Math.max(size.width,size.height));
    const resized=ratio<1?img.resize({width:Math.max(1,Math.round(size.width*ratio)),height:Math.max(1,Math.round(size.height*ratio))}):img;
    let out;
    try { out=resized.toJPEG(Math.max(60,84-i*6)); } catch { throw new Error('Conversion JPG impossible : essaie de réexporter ton image en JPG.'); }
    if(out.length<=LIMIT_SAVED_BYTES)return {bytes:out,kind:{ext:'jpg',mime:'image/jpeg'},optimized:true};
    max=Math.round(max*.8);
  }
  throw new Error('Impossible de réduire cette image sous 8 Mo. Essaie un JPG plus petit.');
}
module.exports={imageKind,prepareWallpaper,LIMIT_INPUT_BYTES,LIMIT_SAVED_BYTES};
