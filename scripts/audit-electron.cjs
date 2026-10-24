'use strict';
/**
 * Electron est déclaré en devDependencies, mais son moteur (Chromium + Node.js)
 * est livré DANS l'application installée. `npm audit --omit=dev` l'ignore donc :
 * ce contrôle bloque la publication si Electron a une vulnérabilité élevée ou critique.
 */
const cp = require('node:child_process');

function runAudit() {
  const npmCli = process.env.npm_execpath;
  const viaNode = npmCli && /\.c?js$/.test(npmCli);
  const command = viaNode ? process.execPath : 'npm';
  const args = viaNode ? [npmCli, 'audit', '--json'] : ['audit', '--json'];
  let output;
  try {
    output = cp.execFileSync(command, args, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
      shell: !viaNode && process.platform === 'win32'
    });
  } catch (error) {
    // npm audit renvoie un code non nul dès qu'une vulnérabilité existe, même mineure.
    output = error.stdout;
    if (!output) throw error;
  }
  return JSON.parse(output);
}

const version = require('electron/package.json').version;
const report = runAudit();
if (report.error) {
  console.error(`Audit npm impossible : ${report.error.summary || JSON.stringify(report.error)}`);
  process.exit(2);
}
const entry = report.vulnerabilities?.electron;
if (entry && ['high', 'critical'].includes(entry.severity)) {
  const advisories = entry.via.filter(item => typeof item === 'object')
    .map(item => `- ${item.title} (${item.range}) ${item.url}`);
  const fix = entry.fixAvailable?.version;
  console.error(`Electron ${version} : vulnérabilité ${entry.severity} connue.\n${advisories.join('\n')}`);
  console.error(fix ? `Mettre à jour : npm install --save-exact --save-dev electron@${fix}` : 'Aucune version corrigée annoncée par npm pour l’instant.');
  process.exit(1);
}
console.log(`Electron ${version} : aucune vulnérabilité élevée ou critique connue.`);
