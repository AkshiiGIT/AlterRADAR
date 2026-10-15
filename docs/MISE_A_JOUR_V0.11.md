# AlterRADAR v0.11.0 — mise à jour sur le dépôt existant

## Statut vérifiable

Cette archive est un **candidat à la publication**, pas une release certifiée. Le registre npm n'était pas accessible lors de sa génération : le `package-lock.json` ne peut PAS être inventé. Il faut le créer une fois sur la machine Mac connectée à npm, puis le versionner. Les tests de code et d'interface ont été exécutés ; le test réel des dépendances et des installateurs doit être fait sur macOS et Windows.

## Mac avec Fish (compatible également avec zsh/bash)

Dans le dossier **de ton dépôt Git existant** (celui qui contient `.git` et qui suit `origin/main`), fais une sauvegarde de ton travail avec `git status` et committe/stashe tes modifications locales avant de copier les nouvelles sources. **Ne remplace pas le dossier `.git` et ne supprime pas les fichiers de données locaux.**

1. Décompresse cette archive. Copie les fichiers nouveaux et modifiés dans ton dépôt local depuis Finder, sans copier les prévisualisations ni `.git` et sans écraser les fichiers personnels. Tu peux également décompresser l'archive directement dans un clone *propre* du dépôt.
2. Vérifie avec `git diff` que seuls les fichiers du code ont changé.
3. Crée le verrouillage de dépendances **une seule fois** :

```sh
node -v                        # v24 attendu
npm -v                         # v11 recommandé
npm install --package-lock-only --ignore-scripts
npm ci                         # Installe exactement le graphe du lockfile
npm run check:lock
npm test
npm run smoke:deps             # Vérifie VRAIS DOCX, PDF, e-mail
npm audit --omit=dev --audit-level=high
npm audit                       # Audit global, avertissements de dev inclus
```

`npm audit` peut révéler des vulnérabilités transitives : examiner chaque rapport plutôt que `npm audit fix --force`. Si l'installation ou le smoke test échoue, **ne pousse pas encore la version ni un tag**. Remonte les journaux pour corriger l'API et réessayer.

4. Quand **tout passe**, pousse les fichiers dont `package-lock.json` :

```sh
git status
git add package.json package-lock.json .nvmrc .github/workflows/build-desktop.yml electron lib renderer scripts tests docs README.md CHANGELOG-v0.11.0.md .gitignore
git diff --cached --stat
npm run check:public
git diff --cached -- . ':!*.png' ':!*.icns' ':!*.ico'  # relire les changements
# Jamais de CV réel, clés, mot de passe, token BotFather ou secret SMTP.
git commit -m "feat: AlterRADAR v0.11.0 - modernisation et UX"
git push origin main
```

Si `git add` mentionne un chemin non présent dans le dépôt, retire-le de la commande. Ne fais pas `git init`, `git push --force` ni `git remote add origin` dans le dépôt déjà configuré.

## Générer les installateurs

1. GitHub > Actions > **Build et publier AlterRADAR** > Run workflow > branche `main`.
2. Le workflow exécute `npm ci`, tests, smoke des bibliothèques, audit production et `electron-builder --publish never` sous Windows et macOS.
3. Télécharge les **Artifacts** `.exe`/`.dmg`. Vérifie le démarrage et les imports PDF/DOCX sur les deux systèmes et le cycle complet Ollama/Telegram avec des données factices.
4. Après vérification réelle, crée le tag :

```sh
git tag v0.11.0
git push origin v0.11.0
```

Le tag crée une Release **brouillon** : publie-la manuellement après tests et signatures éventuelles.

Les applications non signées peuvent provoquer des avertissements Windows SmartScreen ou macOS Gatekeeper. Une compilation réussie ne constitue pas un test d'installation ni une garantie de sécurité. Les tests SMTP/Télégram doivent utiliser des comptes de test avant les premiers envois réels.
