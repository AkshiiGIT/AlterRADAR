# Premier push GitHub — AlterRADAR v0.10.0

Le dépôt **public** `akshiiGIT/AlterRADAR` doit d'abord être créé sur [GitHub](https://github.com/new), dans le compte `akshiiGIT`, avec **Public** sélectionné et sans README ou `.gitignore` généré automatiquement. Cette archive n'ouvre pas le dépôt pour toi et n'envoie rien sur GitHub toute seule.

## Mac : premier push

Dans Terminal, remplace le chemin par le vrai dossier que tu as extrait :

```bash
cd ~/Downloads/AlterRADAR-v0.10.0
npm install
npm test

git init
git branch -M main
git add .
npm run check:public
git diff --cached --stat
# Parcours ce qui sera publié, en particulier les petits fichiers texte :
git diff --cached -- . ':!*.png' ':!*.icns' ':!*.ico'

git commit -m "feat: AlterRADAR v0.10.0 - matching métier et documents ATS une page"
git remote add origin https://github.com/akshiiGIT/AlterRADAR.git
git push -u origin main
```

**Jamais de CV réel, lettres réelles, données locales, secrets BotFather, identifiants SMTP ou clés API dans Git.** Le `.gitignore` couvre des cas courants mais ne constitue pas une garantie ; `check:public` n'est qu'une détection de motifs évidents.

Si `git remote add origin` renvoie « already exists » : `git remote set-url origin https://github.com/akshiiGIT/AlterRADAR.git`.

Si `git push` échoue par manque d'authentification, connecte-toi avec GitHub CLI (`gh auth login`) ou ton gestionnaire d'identifiants Git. Il ne faut jamais insérer un token directement dans l'URL du remote.

## Si ton dépôt contient déjà des commits

Ne relance pas `git init` dans un nouveau dossier et ne fais pas de `push --force` : clone le dépôt puis copie **les fichiers sources** de cette version par-dessus, sans `.git`, ni node_modules, ni données locales. Dans le dépôt cloné :

```bash
git status
git add .
npm run check:public
git diff --cached --stat
git commit -m "feat: AlterRADAR v0.10.0"
git push origin main
```

## Installateurs `.dmg` / `.exe`

Une fois les sources sur GitHub, ouvre **Actions → Build et publier AlterRADAR → Run workflow**. Les runners macOS et Windows peuvent générer des artefacts à télécharger depuis le workflow : ils **ne deviennent pas automatiquement une application signée et distribuée au public**.

Pour préparer une release brouillon avec les binaires compilés, après les tests :

```bash
git tag v0.10.0
git push origin v0.10.0
```

Les `.dmg` et `.exe` doivent être testés sur Mac/Windows réels ; les applications non signées déclenchent parfois des protections du système. Vérifie aussi l'export réel d'un CV et d'une lettre **sur une page A4** dans les PDF/DOCX produits sur une machine équipée des dépendances : les tests actuels couvrent le moteur de pagination et le code, pas le rendu de Word sur toutes les versions.

La publication doit rester manuelle, après vérification de la sécurité, du fonctionnement du bot Telegram et du parcours de candidature.
