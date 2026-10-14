'use strict';
const crypto = require('node:crypto');

// 64 bits, 10-minute expiry, never stored remotely by AlterRADAR.
function createPairingChallenge(now=Date.now()) {
  return {code: crypto.randomBytes(8).toString('hex').toUpperCase(), expiresAt: now + 10*60*1000};
}
function pairingCodeFromText(text) {
  const value = String(text || '').trim();
  const result = /^(?:(?:\/(?:start|connect|lier)(?:@[A-Za-z][A-Za-z0-9_]{4,31})?)\s+)?([a-f0-9]{16})$/i.exec(value);
  return result ? result[1].toUpperCase() : null;
}
function pairingMatches(update, challenge, now=Date.now()) {
  const message=update?.message;
  if (!message || !challenge || now >= challenge.expiresAt) return false;
  if (message.chat?.type !== 'private' || message.from?.is_bot) return false;
  if (!Number.isSafeInteger(message.chat?.id) || String(message.chat.id)!==String(message.from?.id)) return false;
  const input=pairingCodeFromText(message.text);
  return Boolean(input && input===challenge.code);
}
module.exports={createPairingChallenge,pairingCodeFromText,pairingMatches};
