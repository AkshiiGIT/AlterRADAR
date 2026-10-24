# Publier une version d’AlterRADAR

Procédure pour le mainteneur du dépôt `AkshiiGIT/AlterRADAR`. Le dépôt existe déjà : ne refais pas de `git init`.

## 1. Vérifier en local

Avec Node.js 24 :

```bash
npm ci
npm run verify:release   # tests, lockfile, smoke DOCX/PDF/e-mail, contrôle des fichiers indexés
npm run self-test        # lance Electron sans fenêtre et affiche un rapport JSON
```

`check:public` ne contrôle que les fichiers indexés : lance-le après `git add`. Relis aussi `git diff --cached` : aucun CV, `radar-data.json`, `.eml`, jeton ou clé ne doit apparaître.

## 2. Pousser sur `main`

```bash
git add -A
git status            # relire la liste
npm run check:public
git commit -m "AlterRADAR v0.14.0"
git push origin main
```

Le workflow **Tests Windows et macOS** se lance à chaque push. Attends qu’il soit vert dans l’onglet **Actions**.

## 3. Construire les installateurs

Option sans publication : **Actions → Build et publier AlterRADAR → Run workflow**. Les installateurs apparaissent dans les artefacts du run (`AlterRADAR-Windows`, `AlterRADAR-macOS`), conservés 30 jours.

Option release : crée et pousse un tag qui correspond à la version de `package.json`.

```bash
git tag v0.14.0
git push origin v0.14.0
```

Le workflow, sur Windows puis sur macOS :

1. installe les dépendances et lance les tests ;
2. construit les installateurs (`Setup.exe`, `Portable.exe`, `.dmg` et `.zip` arm64/x64) ;
3. vérifie la signature ad hoc macOS (`codesign --verify`) ;
4. lance chaque application construite avec `--self-test` : génération DOCX et PDF, lecture PDF, brouillon e-mail, icône et affichage de l’interface ;
5. crée une **Release en brouillon** avec les installateurs et `SHA256SUMS.txt`.

## 4. Tester avant de publier

Télécharge les fichiers depuis la Release brouillon et vérifie au moins, sur un vrai PC Windows et un vrai Mac :

- [ ] l’installation et le premier lancement (avertissements décrits dans `INSTALLATION.md`) ;
- [ ] l’import d’un CV PDF et DOCX fictif, la construction du profil ;
- [ ] une recherche d’offres et le diagnostic des sources ;
- [ ] l’export DOCX et PDF d’un CV, ouverture dans Word / Aperçu ;
- [ ] avec Ollama : génération d’un CV et d’une lettre ;
- [ ] la surveillance : fermeture de la fenêtre, icône près de l’horloge / dans la barre des menus, « Quitter complètement » ;
- [ ] une seconde ouverture d’AlterRADAR rouvre la fenêtre existante.

Puis, sur la Release brouillon : relis les notes (reprends la section du `CHANGELOG.md`) et clique sur **Publish release**.

## 5. Version suivante

1. Mets à jour `version` dans `package.json`, puis `npm install --package-lock-only` pour synchroniser `package-lock.json`.
2. Adapte le test qui fixe la version (`tests/modernization.test.cjs`).
3. Ajoute une section en haut de `CHANGELOG.md`.
4. Reprends à l’étape 1.

## Signature des installateurs (facultatif, payant)

Sans certificat, Windows SmartScreen et macOS Gatekeeper avertissent l’utilisateur. Pour supprimer ces avertissements :

- **macOS** : compte Apple Developer (99 $/an). Ajoute les secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` et `APPLE_TEAM_ID` au dépôt, retire `"identity": "-"` et passe `"hardenedRuntime": true` dans `package.json`, supprime `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` du workflow et active la notarisation (`"notarize": true`).
- **Windows** : certificat de signature de code (ou Azure Trusted Signing). Ajoute `WIN_CSC_LINK` et `WIN_CSC_KEY_PASSWORD` en secrets.

Documentation : [electron.build/code-signing](https://www.electron.build/code-signing).
