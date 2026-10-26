# Installer AlterRADAR

Télécharge les fichiers uniquement depuis la page **[Releases](https://github.com/AkshiiGIT/AlterRADAR/releases/latest)** du dépôt officiel.

AlterRADAR est gratuit et n’est pas signé avec un certificat payant (Microsoft ou Apple). Windows et macOS affichent donc un avertissement au premier lancement. C’est attendu : les étapes ci-dessous permettent d’ouvrir l’application une fois, ensuite elle se lance normalement.

## Windows 10 et 11

1. Télécharge `AlterRADAR-x.y.z-Windows-x64-Setup.exe`. Sur un PC à processeur ARM (Snapdragon, certaines Surface), prends `…-Windows-arm64-Setup.exe`. En cas de doute : **Paramètres → Système → Informations système → Type du système**.
2. Ouvre-le. Si l’écran bleu **« Windows a protégé votre ordinateur »** apparaît, clique sur **Informations complémentaires**, puis sur **Exécuter quand même**.
3. Suis l’installateur. Il crée un raccourci sur le Bureau et dans le menu Démarrer.

Tu préfères ne rien installer ? Prends `AlterRADAR-x.y.z-Windows-x64-Portable.exe` et lance-le directement, depuis une clé USB par exemple. Les données restent dans `%APPDATA%\AlterRADAR`.

Pour désinstaller : **Paramètres → Applications → AlterRADAR → Désinstaller**. Tes données ne sont pas effacées ; supprime le dossier `%APPDATA%\AlterRADAR` pour les retirer.

## macOS 12 Monterey ou plus récent

1. Télécharge le `.dmg` correspondant à ton Mac :
   - puce Apple (M1, M2, M3, M4…) : `AlterRADAR-x.y.z-macOS-arm64.dmg`
   - processeur Intel : `AlterRADAR-x.y.z-macOS-x64.dmg`

   En cas de doute : menu Apple → **À propos de ce Mac**.
2. Ouvre le `.dmg` et glisse **AlterRADAR** dans **Applications**.
3. Lance AlterRADAR depuis le dossier Applications. macOS indique qu’il ne peut pas vérifier l’application : clique sur **Terminé** (ou **OK**).
4. Ouvre **Réglages Système → Confidentialité et sécurité**, descends jusqu’au message concernant AlterRADAR et clique sur **Ouvrir quand même**. Confirme avec ton mot de passe.

Sur macOS 14 et versions antérieures, un clic droit sur l’application → **Ouvrir** → **Ouvrir** suffit.

Alternative en Terminal, après avoir copié l’application dans Applications :

```bash
xattr -dr com.apple.quarantine /Applications/AlterRADAR.app
```

Au lancement, surtout après une mise à jour, macOS peut demander l’accès au trousseau « AlterRADAR Safe Storage » : saisis ton mot de passe de session et choisis **Toujours autoriser**. Cette clé sert à chiffrer tes jetons Telegram, SMTP et API sur ton Mac.

Pour désinstaller : glisse AlterRADAR d’Applications vers la Corbeille. Les données se trouvent dans `~/Library/Application Support/AlterRADAR`.

## IA locale avec Ollama (facultatif)

La recherche d’offres fonctionne sans IA. Pour générer des CV et lettres adaptés :

1. Installe [Ollama](https://ollama.com/download) (Windows ou macOS) et lance-le.
2. Dans AlterRADAR, ouvre **Paramètres → Modèle IA local**.
3. Choisis le modèle conseillé pour ta mémoire vive et clique sur **Installer**. Compte entre 1 et 9 Go de téléchargement selon le modèle.

## Surveillance en arrière-plan

Quand la surveillance est activée, fermer la fenêtre ne quitte pas AlterRADAR : l’application reste dans la zone de notification (Windows, près de l’horloge) ou dans la barre des menus (macOS). Pour l’arrêter complètement : clic sur l’icône → **Quitter complètement**.

L’option de démarrage avec la session ne fonctionne qu’avec l’application installée (pas en lançant depuis le code source).

## Depuis le code source

Pour contribuer ou tester la dernière version de développement : installe [Node.js](https://nodejs.org/) 24 LTS et Git, puis :

```bash
git clone https://github.com/AkshiiGIT/AlterRADAR.git
cd AlterRADAR
npm ci
npm start
```

Les lanceurs `Lancer-AlterRADAR.bat` (Windows) et `Lancer-AlterRADAR.command` (macOS) font la même chose par double-clic. Sur macOS, si le lanceur est bloqué : clic droit → **Ouvrir**.

## En cas de problème

| Problème | Solution |
|---|---|
| « AlterRADAR est endommagé » sur Mac | Utilise la commande `xattr` ci-dessus. Vérifie aussi que tu as pris le bon `.dmg` (arm64 ou x64). |
| « Ollama hors ligne » | Lance Ollama, puis rouvre **Paramètres**. Ollama doit écouter sur `127.0.0.1:11434`. |
| Aucune offre trouvée | Ouvre **Surveillance & Telegram → Diagnostic des sources** pour voir quelles sources répondent. Élargis les villes, le rayon ou le secteur. |
| Le PDF du CV n’est pas lu | Un PDF scanné (image) ne contient pas de texte : exporte ton CV depuis Word ou Google Docs en PDF texte, ou importe le `.docx`. |
| Réseau d’école ou d’entreprise | Certains proxys bloquent les API d’offres. Essaie depuis une autre connexion pour confirmer. |

Pour signaler un bug : [Issues GitHub](https://github.com/AkshiiGIT/AlterRADAR/issues), en précisant ton système et la version d’AlterRADAR (**Paramètres → À propos**).
