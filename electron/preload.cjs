'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('radar', Object.freeze({
  state: () => ipcRenderer.invoke('app:get-state'),
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
  sourceCredentials: (id,form) => ipcRenderer.invoke('app:source-credentials',id,form),
  buildProfile: () => ipcRenderer.invoke('app:profile-build'),
  buildProfileFast: () => ipcRenderer.invoke('app:profile-build-fast'),
  telegramSave: data => ipcRenderer.invoke('app:telegram-save',data),
  telegramTest: () => ipcRenderer.invoke('app:telegram-test'),
  telegramBeginPairing: () => ipcRenderer.invoke('app:telegram-begin-pairing'),
  telegramReview: id => ipcRenderer.invoke('app:telegram-review',id),
  smtpSave: data => ipcRenderer.invoke('app:smtp-save',data),
  saveJobEmail: (id,email) => ipcRenderer.invoke('app:job-email',id,email),
  sendValidated: id => ipcRenderer.invoke('app:send-validated',id),
  system: () => ipcRenderer.invoke('app:system'),
  models: () => ipcRenderer.invoke('app:models'),
  installRecommendedModel: () => ipcRenderer.invoke('app:install-recommended-model'),
  onModelPull: listener => {
    if(typeof listener !== 'function')return;
    ipcRenderer.on('ollama:pull-progress',(_event,info)=>listener(info));
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
