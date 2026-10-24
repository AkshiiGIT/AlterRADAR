'use strict';
const { contextBridge, ipcRenderer } = require('electron');
// Permet au CSS d'adapter la fenêtre (zone de déplacement et boutons macOS, etc.).
const platform = ['darwin', 'win32', 'linux'].includes(process.platform) ? process.platform : 'other';
window.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.platform = platform; });
contextBridge.exposeInMainWorld('radar', Object.freeze({
  platform,
  state: () => ipcRenderer.invoke('app:get-state'),
  jobDistances: () => ipcRenderer.invoke('app:job-distances'),
  openContact: type => ipcRenderer.invoke('app:open-contact',type),
  emailDraft: (id,saveAs) => ipcRenderer.invoke('app:email-draft',id,saveAs),
  emailCopy: id => ipcRenderer.invoke('app:email-copy',id),
  saveJobRecruiter: (id,data) => ipcRenderer.invoke('app:job-recruiter',id,data),
  addRule: rule => ipcRenderer.invoke('app:rules-add',rule),
  updateRule: (id,patch) => ipcRenderer.invoke('app:rules-update',id,patch),
  deleteRule: id => ipcRenderer.invoke('app:rules-delete',id),
  addBoard: url => ipcRenderer.invoke('app:board-add',url),
  removeBoard: url => ipcRenderer.invoke('app:board-remove',url),
  scanNow: () => ipcRenderer.invoke('app:scan-now'),
  verifyJobDate: id => ipcRenderer.invoke('app:verify-job-date',id),
  onPublicationDate: listener => {if(typeof listener!=='function')return ()=>{};const handler=(_e,payload)=>listener(payload);ipcRenderer.on('app:publication-date-updated',handler);return ()=>ipcRenderer.removeListener('app:publication-date-updated',handler);},
  sourceCredentials: (id,form) => ipcRenderer.invoke('app:source-credentials',id,form),
  buildProfile: () => ipcRenderer.invoke('app:profile-build'),
  buildProfileFast: () => ipcRenderer.invoke('app:profile-build-fast'),
  telegramSave: data => ipcRenderer.invoke('app:telegram-save',data),
  telegramTest: () => ipcRenderer.invoke('app:telegram-test'),
  telegramHealth: () => ipcRenderer.invoke('app:telegram-health'),
  telegramBeginPairing: () => ipcRenderer.invoke('app:telegram-begin-pairing'),
  telegramReview: id => ipcRenderer.invoke('app:telegram-review',id),
  smtpSave: data => ipcRenderer.invoke('app:smtp-save',data),
  saveJobEmail: (id,email) => ipcRenderer.invoke('app:job-email',id,email),
  sendValidated: id => ipcRenderer.invoke('app:send-validated',id),
  system: () => ipcRenderer.invoke('app:system'),
  models: () => ipcRenderer.invoke('app:models'),
  modelPullStatus: () => ipcRenderer.invoke('app:model-pull-status'),
  cancelModelPull: () => ipcRenderer.invoke('app:cancel-model-pull'),
  installRecommendedModel: () => ipcRenderer.invoke('app:install-recommended-model'),
  qwenCatalog: () => ipcRenderer.invoke('app:qwen-catalog'),
  installModel: name => ipcRenderer.invoke('app:install-model',name),
  wallpaperImport: () => ipcRenderer.invoke('app:wallpaper-import'),
  wallpaperGet: () => ipcRenderer.invoke('app:wallpaper-get'),
  wallpaperClear: () => ipcRenderer.invoke('app:wallpaper-clear'),
  onModelPull: listener => {
    if(typeof listener !== 'function')return ()=>{};
    const handler=(_event,info)=>listener(info);
    ipcRenderer.on('ollama:pull-progress',handler);
    return ()=>ipcRenderer.removeListener('ollama:pull-progress',handler);
  },
  saveProfile: fields => ipcRenderer.invoke('app:profile-save', fields),
  saveSettings: fields => ipcRenderer.invoke('app:settings-save', fields),
  importDocument: kind => ipcRenderer.invoke('app:document-import',kind),
  saveDocumentText: (kind,text) => ipcRenderer.invoke('app:document-save-text',kind,text),
  importBoard: (url,onlyAlternance) => ipcRenderer.invoke('app:job-import-board',url,onlyAlternance),
  addJob: data => ipcRenderer.invoke('app:job-add',data),
  setJobStatus: (id,status) => ipcRenderer.invoke('app:job-status',id,status),
  generate: (id,kind) => ipcRenderer.invoke('app:generate',id,kind),
  saveGenerated: (id,kind,text) => ipcRenderer.invoke('app:generated-save',id,kind,text),
  exportGenerated: (id,kind,format) => ipcRenderer.invoke('app:export',id,kind,format),
  openUrl: url => ipcRenderer.invoke('app:open-url',url),
  openOllama: () => ipcRenderer.invoke('app:open-ollama')
}));
