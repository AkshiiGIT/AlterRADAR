# Passage de la v0.11.0 à la v0.12.0 — Mac Fish, sans effacer les données

La mise à jour préserve `electron/main.cjs` dans la même application Electron (`appId: fr.alterradar.desktop`) et conserve le schéma des données locales. Les nouvelles préférences possèdent des valeurs par défaut.

## Application du ZIP de correctifs

Le dossier Git local doit être `~/Downloads/AlterRADAR`, avec `origin/main` déjà configuré. Le ZIP doit d'abord être téléchargé dans `~/Downloads`.

```fish
cd ~/Downloads/AlterRADAR
git status
# Si modifications locales importantes, les sauvegarder avant la mise à jour.
git branch sauvegarde-avant-v012
mkdir -p ~/Downloads/AlterRADAR-v012-extraction
unzip -oq ~/Downloads/AlterRADAR-v0.12.0-Mise-a-jour.zip -d ~/Downloads/AlterRADAR-v012-extraction
rsync -av ~/Downloads/AlterRADAR-v012-extraction/AlterRADAR-v0.12.0-Mise-a-jour/ ./
npm pkg get version
```

La création de la branche est à faire **une seule fois** ; si elle existe déjà, ce n'est pas une erreur bloquante. Vérifier `0.12.0` avant de continuer. `rsync` sans `--delete` ne supprime aucun autre fichier du projet.

## Dépendances et tests

```fish
npm install --package-lock-only --ignore-scripts
npm ci
npm run check:lock
npm test
npm run smoke:deps
npm run audit:production
npm start
```

**Ne pas exécuter `npm audit fix --force`** pour éliminer de force des dépendances transitives. Si l'une des commandes échoue, corriger avant de pousser. Vérifier dans l'app : 6 offres compatibles sur 34 analysées, offre Bac+5 masquée pour un niveau Bac+3, paramètres Qwen, lien LinkedIn et fond teinté. Vérifier les autres fonctions (import CV, génération, suivi, Telegram) avant toute distribution.

## Publication du code

```fish
git status
git diff --stat
git add package.json package-lock.json config/creator.json electron/main.cjs electron/preload.cjs lib/rules.cjs lib/discovery.cjs lib/ollama.cjs renderer/app.js renderer/style.css tests/modernization.test.cjs tests/upgrade-0.12.test.cjs tests/appearance_smoke.py README.md CHANGELOG-v0.12.0.md docs/MISE_A_JOUR_V0.12.md
npm run check:public
git diff --cached --stat
git diff --cached
git commit -m "feat: AlterRADAR v0.12.0 - UX, modèles et apparence"
git push origin main
```

**Ne pas publier** de CV réels, lettres personnelles, `radar-data.json`, `.env`, jetons Telegram, données SMTP ni d'images privées. Le `package-lock.json` doit être suivi par Git pour les builds reproductibles.

## Installateurs

Sur GitHub Actions, lancer « Build et publier AlterRADAR » sur `main`. Confirmer la compilation Windows et macOS avant de télécharger les artifacts. Tester un `.dmg` sur macOS et un `.exe` sur Windows, sans Node.js installé. Ne créer de tag Release qu'après ces vérifications ; les versions non signées peuvent déclencher Gatekeeper/SmartScreen.
