# AlterRADAR v0.5.1 — Correctif de surveillance

- Corrige le HTML de la case « Activer la surveillance en arrière-plan » (`monitoringEnabled`), qui provoquait `Cannot read properties of undefined (reading 'checked')` lors de l'enregistrement.
- Ajoute deux tests de régression pour les cases du formulaire de surveillance.
- Ajoute un test dans Chromium qui désactive cette case et enregistre les paramètres sans erreur JavaScript.
- Ne modifie pas le format des données utilisateur stockées localement.

## Mise à jour rapide du projet déjà installé en mode développement

1. Quitter AlterRADAR.
2. Remplacer le fichier `renderer/app.js` de l'ancien dossier par celui fourni dans v0.5.1.
3. Relancer `npm start` dans l'ancien dossier.

Aucune réinstallation npm n'est nécessaire pour le correctif seul.

## Repartir du projet complet v0.5.1

Décompresser le dossier AlterRADAR-v0.5.1, puis dans le Terminal :

```sh
cd ~/Downloads/AlterRADAR-v0.5.1
npm install
npm test
npm start
```

Les fichiers sources ne contiennent pas tes CV, historiques et identifiants : les données utilisateur sont stockées séparément par Electron dans le dossier utilisateur de l'application.
