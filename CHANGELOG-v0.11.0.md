# AlterRADAR v0.11.0 — Candidat à la release

## Base conservée

Projet construit à partir des sources v0.10.0. Le modèle de données local garde `schema: 2`, le même `appId` et le même chemin `userData` : aucun effacement automatique de CV, règles, candidatures ou réglages. Les fonctions de recherche, matching, Stage/Alternance, Telegram et export restent présentes.

## Modernisation

- Node.js 24 LTS pour le workflow CI ; fichier `.nvmrc` pour les développeurs.
- Electron **44.7.2**, electron-builder **26.15.3** (versions stables).
- docx **9.11.0**, mammoth **1.13.0**, pdfkit **0.20.2**, pdf-parse **2.4.5**, nodemailer **10.1.1** (versions épinglées).
- Lecture PDF migrée de l'API `pdf-parse` 1.x vers la classe `PDFParse` 2.x avec destruction du worker.
- Tests de fumée des **vrais formats** DOCX, PDF, EML en CI ; `npm ci` et audit des vulnérabilités élevées en production.
- `electron-builder` ne tente plus de publier automatiquement pendant la compilation.
- Lockfile requis et vérifié avant build. **Il doit être généré sur un poste ayant accès à npm puis committé avant la Release**.

## Interface

- Échelle d'espacement unifiée (8/12/16/24/32/40 px).
- Respiration entre bandeau métier, recherche, cartes d'offres et filtres.
- Boutons, formulaires et panneau de détails plus espacés, y compris dans les fenêtres étroites.
- Les corrections ciblent les sélecteurs existants sans réécrire les gestionnaires d'événements.

## Vérifications

- 74 tests unitaires Node réussis dans l'environnement d'édition, dont 6 tests de migration et régression supplémentaires.
- 42 contrôles responsive (6 résolutions × 7 écrans) réussis sans débordement horizontal.
- La compilation et l'exécution avec les nouvelles bibliothèques **restent à confirmer** sur les runners natifs ; le registre npm n'est pas accessible dans l'environnement d'édition.
