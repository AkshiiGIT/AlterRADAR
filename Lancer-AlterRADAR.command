#!/bin/bash
set -u
cd "$(dirname "$0")" || exit 1
printf '\n🚀 AlterRADAR — démarrage local\n\n'
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js LTS est nécessaire pour lancer cette VERSION SOURCE.'
  echo 'Installe Node.js depuis https://nodejs.org puis relance ce fichier.'
  read -r -p 'Appuie sur Entrée pour fermer…' _
  exit 1
fi
if [ ! -d node_modules/electron ]; then
  echo 'Première ouverture : installation des dépendances…'
  npm install || { echo 'Installation impossible.'; read -r -p 'Entrée pour fermer…' _; exit 1; }
fi
npm start
RESULT=$?
echo "AlterRADAR s’est arrêté (code $RESULT)."
read -r -p 'Appuie sur Entrée pour fermer…' _
exit "$RESULT"
