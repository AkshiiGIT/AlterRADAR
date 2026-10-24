'use strict';
/** pdf-parse 2.x : import local sans upload du CV ni OCR implicite. */

/**
 * pdf.js (embarqué par pdf-parse) crée un `DOMMatrix` dès son chargement.
 * Dans le processus principal d'Electron, il le prend dans le module natif
 * @napi-rs/canvas. Ce binaire n'existe pas pour toutes les architectures :
 * il manque sur un build macOS Intel fabriqué depuis un Mac Apple Silicon et
 * sur Windows ARM. Sans repli, l'import d'un CV PDF échouerait entièrement.
 * L'extraction de texte n'utilise pas ces matrices : un repli minimal suffit.
 */
class FallbackDOMMatrix {
  constructor(init) {
    const values = Array.isArray(init) && init.length === 6 ? init.map(Number) : [1, 0, 0, 1, 0, 0];
    [this.a, this.b, this.c, this.d, this.e, this.f] = values;
  }
  get is2D() { return true; }
  get isIdentity() { return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0; }
  multiplySelf(m) {
    const { a, b, c, d, e, f } = this;
    this.a = a * m.a + c * m.b; this.b = b * m.a + d * m.b;
    this.c = a * m.c + c * m.d; this.d = b * m.c + d * m.d;
    this.e = a * m.e + c * m.f + e; this.f = b * m.e + d * m.f + f;
    return this;
  }
  preMultiplySelf(m) { const copy = new FallbackDOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]); copy.multiplySelf(this); Object.assign(this, { a: copy.a, b: copy.b, c: copy.c, d: copy.d, e: copy.e, f: copy.f }); return this; }
  multiply(m) { return new FallbackDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).multiplySelf(m); }
  translateSelf(x = 0, y = 0) { return this.multiplySelf(new FallbackDOMMatrix([1, 0, 0, 1, x, y])); }
  translate(x = 0, y = 0) { return this.multiply(new FallbackDOMMatrix([1, 0, 0, 1, x, y])); }
  scaleSelf(x = 1, y = x) { return this.multiplySelf(new FallbackDOMMatrix([x, 0, 0, y, 0, 0])); }
  scale(x = 1, y = x) { return this.multiply(new FallbackDOMMatrix([x, 0, 0, y, 0, 0])); }
  invertSelf() {
    const det = this.a * this.d - this.b * this.c;
    if (!det) { [this.a, this.b, this.c, this.d, this.e, this.f] = [NaN, NaN, NaN, NaN, NaN, NaN]; return this; }
    const { a, b, c, d, e, f } = this;
    this.a = d / det; this.b = -b / det; this.c = -c / det; this.d = a / det;
    this.e = (c * f - d * e) / det; this.f = (b * e - a * f) / det;
    return this;
  }
  inverse() { return new FallbackDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).invertSelf(); }
  transformPoint(p = {}) { const x = p.x || 0, y = p.y || 0; return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f, z: 0, w: 1 }; }
}

function ensurePdfGlobals() {
  if (typeof globalThis.DOMMatrix !== 'undefined') return 'native';
  try {
    const canvas = require('@napi-rs/canvas');
    if (canvas?.DOMMatrix) return 'canvas';
  } catch { /* binaire absent pour cette architecture */ }
  globalThis.DOMMatrix = FallbackDOMMatrix;
  return 'fallback';
}

async function extractPdfText(bytes, api) {
  if (!bytes || !bytes.length) throw new Error('Le PDF est vide.');
  if (!api) { ensurePdfGlobals(); api = require('pdf-parse'); }
  const { PDFParse } = api;
  if (typeof PDFParse !== 'function') throw new Error('pdf-parse v2 est requis. Réinstalle les dépendances (npm ci).');
  const parser = new PDFParse({data: new Uint8Array(bytes)});
  try {
    const result = await parser.getText({ first: 1, last: 12 });
    return String(result?.text || '');
  } catch (err) {
    throw new Error(`Lecture PDF impossible : ${String(err?.message || err).slice(0,180)}`);
  } finally {
    await parser.destroy();
  }
}
module.exports = {extractPdfText, ensurePdfGlobals, FallbackDOMMatrix};
