# AlterRADAR v0.10.0 — Mac et Windows

**Correctifs :** retour détaillé des erreurs Ollama 400, génération moins gourmande en RAM, téléchargement guidé d'un Qwen recommandé suivant la RAM (24 Go → Qwen2.5 7B quantifié), sélection libre des modèles déjà installés, choix Stage/Alternance, métier inféré du CV, lanceurs en double-clic Mac/Windows.

**Sur Mac :** double-cliquer `Lancer-AlterRADAR.command` (Mac peut demander une autorisation de lancement de script téléchargé). Sur Windows : `Lancer-AlterRADAR.bat`. **Ces lanceurs nécessitent encore Node.js** et installent les dépendances au premier lancement seulement. Les futurs installateurs `.dmg` / `.exe` compilés depuis GitHub Actions ne nécessiteront pas Node.js chez l'utilisateur. Ollama est nécessaire pour l'IA locale.

Le choix d'un modèle ne déclenche jamais un téléchargement sans consentement : « Installer Qwen recommandé en 1 clic » dans Paramètres lance le téléchargement via Ollama, à condition qu'Ollama soit démarré. Taille et performances variables selon RAM *disponible*, GPU et modèle.

**Important :** les tests unitaires ne valident pas l'ensemble des APIs d'offres, les envois Telegram/SMTP réels, ni les builds natifs sur tous les appareils. L'envoi sur formulaires ATS reste manuel ou en brouillon selon le site.

**Publication :** voir `docs/PUBLICATION_GITHUB.md` et `docs/SECOND_POST_LINKEDIN.md`. Ne publier aucun CV, jeton Telegram ou mot de passe SMTP.

---

# AlterRADAR · v0.7.0 — Windows + macOS

**Correctif 0.5.1 :** correction de la case « Activer la surveillance en arrière-plan » qui empêchait d’enregistrer les réglages sur macOS et Windows (erreur JavaScript `Cannot read properties of undefined (reading 'checked')`). Les données locales sont conservées lors de la mise à jour.

**Créé et développé par Akasche MAHINTAN.** Application de bureau local-first sous licence MIT, gratuite à télécharger et à utiliser. Moteur Electron, IA locale Ollama, filtres d'alternance, connexion individuelle Telegram, suivi complet des candidatures et génération d'un vrai fichier de brouillon d'e-mail **.eml avec CV + lettre DOCX en pièces jointes**.

**État : version de développement et source à compiler. Ce fichier ZIP ne contient pas encore d'installateur `.exe` ou `.dmg` compilé et testé.** Le dépôt public cible est `https://github.com/akshiiGIT/AlterRADAR`, à créer/publier sur le compte GitHub avant d'annoncer les téléchargements.

## Nouveauté 0.7 : parcours simplifié

1. Importer le CV et éventuellement une ancienne lettre : **analyse automatique du profil** (Ollama si disponible, extraction prudente sinon).
2. Vérifier le profil, notamment le niveau Bac+N, puis confirmer : **première recherche automatique immédiatement**, sans saisir de liens.
3. Option de surveillance horaire dès l’accueil ; filtres école privée activés par défaut et règles personnalisables.
4. Sources API facultatives (clés France Travail/Adzuna) déplacées dans les réglages avancés ; une source communautaire française spécialisée en informatique est proposée en complément. Cette source **ne constitue pas une API institutionnelle** et peut contenir des annonces devenues indisponibles.

**Limite importante :** sans identifiant France Travail/Adzuna, les sources publiques disponibles ne garantissent **ni une couverture exhaustive des offres françaises ni des annonces actualisées**. AlterRADAR conserve le diagnostic de chaque API au lieu d’inventer des résultats. Aucun contact RH n’est inventé ; seuls les e-mails professionnels explicitement diffusés dans les annonces sont proposés. Les réponses des API nécessitent une connexion réseau et n’ont pas été testées en direct depuis cet environnement.

## Nouveauté 0.6.1 : analyse automatique des ATS

Le moteur identifie désormais les URL de **30 logiciels de recrutement**, affiche l'ATS détecté sur chaque offre et peut **étendre automatiquement la recherche** vers les tableaux publics de 9 d'entre eux quand une annonce fournit un lien ATS exploitable. Les extensions sont limitées et espacées pour protéger les services. La détection **ne prouve ni la disponibilité d’une API pour l’entreprise ni la possibilité de candidater automatiquement**. Certains liens indirects et domaines personnalisés restent inconnus.

**9 connecteurs publics programmés :** Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Breezy HR, Teamtailor. **21 autres ATS : reconnaissance des URL uniquement**, sans extraction automatique garantie. Voir [la matrice complète](docs/ATS.md). Les 9 connecteurs sont testés avec des données simulées mais doivent être vérifiés sur de véritables portails employeurs.

## Ce qui change dans la v0.6

**Application destinée uniquement aux candidats.** Premier lancement : importer un **CV** et, idéalement, **une ancienne lettre de motivation** ; l’extraction du profil est désormais déclenchée automatiquement après import, puis le candidat vérifie les champs avant de lancer la recherche. La surveillance peut être activée dès cette étape. AlterRADAR extrait les éléments factuels grâce aux règles locales, ou grâce à un modèle Ollama déjà installé, et demande une validation explicite du candidat. Le diplôme, le niveau Bac+N et les compétences détectés doivent être relus.

**Recherche sans ajouter de lien d'entreprise.** AlterRADAR dispose maintenant de **11 connecteurs programmés**, dont **7 sont activables sans compte ni clé**. Les sources sont activables/désactivables individuellement et interrogées régulièrement avec des temporisations adaptées. Les utilisateurs français gagneront à configurer France Travail et Adzuna (identifiants gratuits sous réserve des conditions de ces fournisseurs). La Bonne Alternance est facultative, désactivée par défaut, et n'est pas utilisée comme source principale.

| Source | Accès | Remarques |
|---|---|---|
| Alternances Tech France (communauté) | Sans clé | Liste publique de la tech (source communautaire, non exhaustive ; liens pouvant expirer) |
| Arbeitnow | Sans clé | Agrégateur européen ; ne garantit pas d'offres françaises |
| Remotive | Sans clé | Remote, faible part d'alternances ; appels espacés |
| Jobicy | Sans clé | Remote ; la fenêtre de disponibilité de l'API peut être limitée |
| Himalayas | Sans clé | Remote ; attribution de la source |
| Remote OK | Sans clé | Remote ; attribution de la source |
| The Muse | Sans clé | Emplois et stages, principalement internationaux |
| France Travail | OAuth gratuit, inscription | Source française importante pour les offres disponibles |
| Adzuna France | App ID + App Key | Recherche d'offres françaises, quotas selon l'API |
| Jooble France | Clé API | Quota très limité ; désactivé par défaut |
| La Bonne Alternance | Clé API | Facultative et désactivée par défaut ; couverture variable |

**Attention :** ces connecteurs ne permettent pas de garantir *toutes* les offres d'alternance. Certaines API changent de contrat, de schéma, de conditions ou de disponibilité. Le filtre « alternance » écarte beaucoup de postes non pertinents, et les sources internationales peuvent ne renvoyer aucune alternance française. Certaines API exposent une fenêtre temporelle restreinte que l'app ne peut pas élargir. Si une source échoue, les autres continuent.

1. AlterRADAR fusionne les offres des sources actives, supprime les doublons sur les URL, puis applique les règles de tri déterministes et le niveau d'études strict.
2. L'option « masquer les écoles privées et organismes de formation » filtre les publications reconnaissables comme telles. Ce filtre est heuristique : un établissement non identifié peut passer, et des entreprises dont le nom ressemble à une école peuvent être exclues. Il est désactivable.
3. Les **adresses professionnelles de contact affichées publiquement dans les offres** sont proposées lorsqu'elles sont détectées. L'utilisateur doit vérifier l'adresse et la pertinence du destinataire. AlterRADAR ne devine pas de mails et n'extrait pas des contacts à partir de profils LinkedIn personnels.
4. Les offres et l'historique restent dans le stockage local de l'application. Ollama peut préparer le CV et la lettre de motivation, sans écraser les originaux.
5. Telegram peut envoyer des alertes et des DOCX pour approbation ; après validation, AlterRADAR génère un e-mail `.eml` avec pièces jointes ou utilise le compte SMTP explicitement configuré, uniquement pour une adresse présente et validée. Les candidatures sur formulaires ATS restent manuelles.

## Lier Telegram avec une clé — sans serveur central

Chaque personne crée **son propre bot gratuit** via [@BotFather](https://t.me/BotFather). Cette étape est requise : fournir **uniquement un code dans un bot partagé sans hébergement central** n'est techniquement pas possible pour des utilisateurs indépendants. La clé générée sert à associer *son propre* bot à *son propre* PC, sans envoyer les documents au développeur.

1. Telegram → @BotFather → `/newbot` → copier le jeton secret.
2. AlterRADAR → **Surveillance & Telegram** → enregistrer le jeton (protégé par le coffre-fort du système).
3. Cliquer sur **Générer le lien de liaison** : l'interface affiche une **clé de 16 caractères**, valable 10 minutes, et un lien d'accès à son bot.
4. Dans une conversation privée avec **ce bot**, envoyer directement la clé seule (ou `/connect CLE`). AlterRADAR vérifie que le code correspond et que le message est privé et provient du même utilisateur. Il enregistre le Chat ID automatiquement. Le PC doit rester connecté pendant la liaison.
5. Dans AlterRADAR, activer les alertes et, si souhaité, la transmission de CV/lettres pour validation.

Le logiciel se connecte directement à `api.telegram.org` depuis le PC par polling ; pas d'hébergement AlterRADAR. Le bot ne fonctionnera que si le PC est éveillé, l'application tourne, et Internet est disponible. Aucun autre programme ni webhook ne doit consommer les updates du même jeton. **Ne communique jamais le jeton à une tierce personne.**

## Confidentialité

**Les fichiers sont conservés localement par défaut.** Aucun serveur AlterRADAR ne stocke les CV et le créateur n'a pas accès aux données personnelles par l'application. Les appels Ollama ciblent `127.0.0.1`.

**Limite importante :** lorsque l'utilisateur active l'envoi vers Telegram, les textes d'offres et éventuellement les CV/lettres quittent son ordinateur vers les serveurs Telegram, qui n'offrent pas de conversation secrète chiffrée de bout en bout avec les bots. En mode SMTP, les e-mails transitent par le fournisseur de messagerie et le recruteur. Les données locales **ne sont pas chiffrées au repos** dans cette version. Détails : [docs/PRIVACY.md](docs/PRIVACY.md).

## Compilations Windows et macOS

Prérequis pour le développement : Node.js 22+ et npm. Ollama est requis uniquement pour l'IA.

```bash
npm install
npm test
npm start
```

Sur **Windows** pour créer `.exe` (NSIS/portable) :

```powershell
npm install
npm run dist:win
```

Sur **macOS** pour créer `.dmg` et `.app` (Intel/Apple Silicon) :

```bash
npm install
npm run dist:mac
```

Un workflow `.github/workflows/build-desktop.yml` construit sur des **runners GitHub Windows et macOS** et prépare une **release brouillon**, avec vérification manuelle requise avant publication. Un fichier `.exe` ou `.dmg` non signé peut déclencher un avertissement de sécurité. La signature/notarisation nécessite éventuellement des comptes payants pour le développeur ; **AlterRADAR reste gratuit pour ses utilisateurs**. Voir [docs/PUBLICATION_GITHUB.md](docs/PUBLICATION_GITHUB.md).

## Coordonnées du créateur

- GitHub : https://github.com/akshiiGIT
- Dépôt cible : https://github.com/akshiiGIT/AlterRADAR (**à publier**)
- Contact professionnel : **akasche.pro@gmail.com**
- LinkedIn : **URL exacte à renseigner** dans `config/creator.json` avant la publication. Ne pas inventer de profil. La page « À propos » le présentera alors sous la forme d'un bouton cliquable.

## Limites et tests

Les tests unitaires valident le filtrage Bac+3, la liaison Telegram, les validations non réutilisables, les règles et la préparation des brouillons. Ils ne remplacent pas les tests de bout en bout sur Windows/macOS, sur des comptes Telegram et SMTP réels, ni une vérification de l'installation/signature sur des machines différentes. Un e-mail accepté par le serveur SMTP ne garantit pas sa réception finale. Le système ne garantit pas toutes les sources du marché ni la justesse des textes IA : **l'utilisateur doit relire les documents**.

© 2026 Akasche MAHINTAN · MIT.

**Mise à jour d’une v0.6.1 :** les réglages personnalisés des API sont conservés. Si les 6 sources activées étaient exactement les valeurs par défaut, la source communautaire française est ajoutée sans effacer les documents ni le suivi. Sauvegarde ton dossier de données locales avant toute mise à jour de développement.


## v0.9.0 : confort sur petit et grand écran

AlterRADAR redimensionne automatiquement sa fenêtre selon l'espace de travail disponible. L'interface utilise la largeur de la fenêtre, et la navigation latérale se réduit sur les petits écrans. La zone centrale défile verticalement pour laisser les formulaires et les longues annonces lisibles : une application complète ne peut pas toujours afficher toutes ses pages en hauteur sans défilement.

La mise à jour ne réinitialise pas les dossiers candidats. Utilisez `Lancer-AlterRADAR.command` sur macOS ou `Lancer-AlterRADAR.bat` sur Windows dans l'archive source, ou construisez l'installateur natif depuis GitHub Actions.


## v0.10.0 — métiers pertinents et documents ATS sur UNE page

Le moteur propose automatiquement les familles de métiers compatibles avec les compétences et la formation du candidat, et exclut par défaut les postes hors domaine (par exemple assistant RH ou recruteur IT pour un profil développeur full-stack). Les résultats et scores sont explicables et la recherche élargie reste facultative.

Les CV et lettres DOCX/PDF utilisent une présentation sobre, une colonne et des marges A4. Le texte trop long est condensé une fois par le modèle lors de la génération ; sinon l'application refuse un export qui risquerait de passer sur plusieurs pages. **Aucune expérience n'est supprimée silencieusement**. Les outils Word et PDF pouvant calculer les retours à la ligne différemment, vérifie le rendu d'un vrai document exporté sur ta machine avant tout envoi.

Pour la publication, consulte [docs/PUBLICATION_GITHUB.md](docs/PUBLICATION_GITHUB.md). Ne partage jamais de CV réels, jetons Telegram, mots de passe ni clés API dans Git.
