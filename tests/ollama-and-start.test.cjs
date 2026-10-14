'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {recommendedDownload,explainOllamaError,parsePullUpdate}=require('../lib/ollama.cjs');
const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
test('24GB RAM recommends Qwen 7B, does not force a model',()=>{
  assert.equal(recommendedDownload(24),'qwen2.5:7b');
  assert.equal(recommendedDownload(8),'qwen2.5:3b');
  assert.equal(recommendedDownload(3),null);
});
test('Ollama HTTP 400 is explained when memory is insufficient',()=>{
  assert.match(explainOllamaError(null,400,'model requires more system memory than is available'),/Mémoire insuffisante/);
  assert.match(explainOllamaError(null,400,'invalid option'),/400.*invalid option/);
});
test('pull status parses total and errors safely',()=>{
  assert.equal(parsePullUpdate('{"status":"downloading","total":100,"completed":50}').percent,50);
  assert.match(parsePullUpdate('{"error":"disk full"}').error,/disk full/);
});
test('macOS dev launch does not change login item permissions',()=>{
  assert.match(main,/if\(app\.isPackaged\)try\{app\.setLoginItemSettings/);
});
test('generation requests are memory-conscious and preserve error body',()=>{
  assert.match(main,/num_ctx: contextSize/);
  assert.match(main,/result\.json\(\)\)\?\.error/);
});
