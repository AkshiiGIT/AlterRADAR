'use strict';
/** Read-only Telegram diagnostic. Does NOT call sendMessage/sendDocument/getUpdates. */
async function checkTelegramHealth({configured=false,chatId='',monitoringEnabled=false,approvalsEnabled=false,request}={}){
  const basics={monitoringEnabled:Boolean(monitoringEnabled),approvalsEnabled:Boolean(approvalsEnabled)};
  if(!configured)return {ready:false,botName:'Bot non configuré',message:'Enregistre un jeton de bot personnel créé avec BotFather.',...basics};
  if(typeof request!=='function')throw new Error('Client Telegram indisponible.');
  const bot=await request('getMe',{});
  if(!bot?.is_bot || typeof bot.username!=='string' || !/^[A-Za-z0-9_]{5,32}$/.test(bot.username)){
    throw new Error('La clé Telegram ne correspond pas à un bot valide.');
  }
  const botName=`@${bot.username}`;
  if(!/^[0-9]{5,20}$/.test(String(chatId||''))){
    return {ready:false,botName,message:'Jeton valide. Termine la liaison dans une conversation privée avec ton bot.',...basics};
  }
  let chat;
  try{chat=await request('getChat',{chat_id:String(chatId)});}
  catch(err){return {ready:false,botName,message:'Bot reconnu, mais le chat lié est inaccessible. Recommence la liaison avec ton bot.',...basics};}
  if(chat?.type!=='private' || String(chat.id)!==String(chatId)){
    return {ready:false,botName,message:'La liaison ne correspond pas à un chat privé. Recommence l’appairage.',...basics};
  }
  return {ready:true,botName,message:'Jeton et chat privé confirmés. Clique sur « Envoyer un test » pour vérifier la réception d’un message. Aucun document n’a été transmis pendant ce diagnostic.',...basics};
}
module.exports={checkTelegramHealth};
