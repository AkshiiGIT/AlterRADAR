'use strict';
/** pdf-parse 2.x : import local sans upload du CV ni OCR implicite. */
async function extractPdfText(bytes, api = require('pdf-parse')) {
  if (!bytes || !bytes.length) throw new Error('Le PDF est vide.');
  const { PDFParse } = api;
  if (typeof PDFParse !== 'function') throw new Error('pdf-parse v2 est requis. Réinstalle les dépendances de la version 0.11.');
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
module.exports = {extractPdfText};
