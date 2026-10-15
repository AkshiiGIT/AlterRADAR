<div align="center">
  <img src="assets/logo.svg" width="88" alt="Logo AlterRADAR" />

  # AlterRADAR

  **L’alternance qui te ressemble, enfin à portée de main.**

  Un assistant de recherche d’**alternances et de stages** pour Windows et macOS,
  conçu pour faire le tri parmi les offres, préparer tes candidatures
  et te laisser le contrôle à chaque étape.

  [![Version](https://img.shields.io/badge/version-0.12.0-9f94ff)](CHANGELOG-v0.12.0.md)
  [![Plateformes](https://img.shields.io/badge/plateformes-macOS%20%7C%20Windows-22283b)](#installation)
  [![Licence](https://img.shields.io/badge/licence-MIT-44c9b3)](LICENSE)
  [![Statut](https://img.shields.io/badge/statut-en%20d%C3%A9veloppement-f0b866)](#état-du-projet)

  **[Découvrir](#pourquoi-alterradar) · [Fonctionnalités](#fonctionnalités) · [Installation](#installation) · [Confidentialité](#confidentialité) · [Contribuer](#contribuer)**
</div>

![Aperçu du tableau de bord AlterRADAR](docs/images/dashboard.png)

> [!IMPORTANT]
> **AlterRADAR v0.12.0 est en développement.** Le code source est disponible, mais les installateurs natifs `.dmg` et `.exe` doivent encore être compilés et validés sur des machines réelles avant d’être recommandés au public. Le fonctionnement des sources d’offres et des intégrations tierces dépend aussi de leur disponibilité.

## Pourquoi AlterRADAR ?

Chercher une alternance ne devrait pas signifier parcourir des centaines d’annonces inadaptées, refaire son CV pour chaque offre ou oublier ses candidatures.

**AlterRADAR rassemble ces étapes dans une application de bureau** : tu importes ton CV, tu vérifies le profil détecté, puis l’application recherche et classe les opportunités selon tes compétences, ton cursus et tes critères. L’IA est **locale et facultative**, grâce à Ollama.

## Fonctionnalités

| | Ce qu’AlterRADAR propose |
|---|---|
| **Profil depuis le CV** | Extraction des informations utiles et validation du profil avant la recherche. Une ancienne lettre peut être importée en complément. |
| **Recherche multi-sources** | Agrégation d’annonces issues de sources publiques et de connecteurs configurables, sans obligation de fournir des liens d’entreprises. |
| **Matching explicable** | Scores indicatifs, détection des métiers pertinents, suppression des doublons et règles personnalisées. |
| **Filtre de niveau Bac+N** | Possibilité d’exclure strictement les annonces qui demandent un niveau supérieur au profil. |
| **Documents adaptés** | Préparation de CV et de lettres ciblés, export DOCX/PDF et présentation lisible par les ATS. Relecture indispensable avant utilisation. |
| **Suivi des candidatures** | Historique des étapes, statuts et documents associés aux offres. |
| **IA locale Qwen / Ollama** | Choix ou installation explicite d’un modèle compatible avec les ressources disponibles. Aucun modèle n’est téléchargé sans action de l’utilisateur. |
| **Telegram facultatif** | Alertes et circuit de validation via le bot personnel de chaque utilisateur. |
| **Apparence personnalisable** | Mode clair/sombre/système, fonds locaux, dégradés et panneaux « Liquid Glass » teintés, avec option de réduction des effets. |

### Aperçus de l’interface

| Recherche et tri des offres | Apparence et Liquid Glass |
|:---:|:---:|
| ![Offres filtrées dans AlterRADAR](docs/images/offres.png) | ![Réglages d’apparence Liquid Glass dans AlterRADAR](docs/images/apparence.png) |

*Captures de démonstration avec un profil fictif. L’apparence et les résultats peuvent varier selon les réglages et les sources.*

## Comment ça marche ?

1. **Importe ton CV** et, si tu le souhaites, une ancienne lettre de motivation.
2. **Vérifie ton profil** : formation, niveau Bac+N, compétences et familles de métiers proposées.
3. **Explore les offres** compatibles, ajuste les règles et ouvre les annonces d’origine.
4. **Prépare et suis tes candidatures** : documents personnalisés, brouillons d’e-mails et étapes de suivi.
5. **Active les options avancées si besoin** : modèle Ollama local, surveillance, Telegram et envoi SMTP après validation.

## Installation

### Option A — installateurs Windows et macOS

Les versions compilées, **lorsqu’elles auront été testées et publiées**, seront accessibles sur la page [Releases](https://github.com/AkshiiGIT/AlterRADAR/releases).

Les installateurs ne nécessiteront pas Node.js côté utilisateur. Une version non signée peut déclencher un avertissement macOS Gatekeeper ou Windows SmartScreen : vérifier la provenance avant de lancer tout exécutable.

### Option B — lancer depuis le code source

**Prérequis :** Node.js **24**, npm et une connexion Internet pour installer les dépendances. [Ollama](https://ollama.com/) est facultatif pour la recherche et nécessaire pour les fonctions d’IA locale.

```bash
git clone https://github.com/AkshiiGIT/AlterRADAR.git
cd AlterRADAR
npm ci
npm start
```

Pour une copie du code téléchargée en ZIP, extraire d’abord l’archive puis lancer `npm ci` et `npm start` à la racine du projet.

Les lanceurs inclus dans les sources (`Lancer-AlterRADAR.command` sur macOS et `Lancer-AlterRADAR.bat` sur Windows) constituent une autre méthode de démarrage ; **eux aussi nécessitent Node.js**. Pour choisir ou installer un modèle local, ouvrir **Paramètres → Ollama** une fois Ollama démarré.

## Sources d’offres et ATS

AlterRADAR prend en charge des sources publiques sans clé et des sources configurables avec identifiants API, notamment **France Travail** et **Adzuna France**. Il reconnaît également les liens de **30 plateformes de recrutement (ATS)** et implémente des connecteurs vers **9 tableaux d’offres publics** quand une URL exploitable est disponible.

La reconnaissance d’un ATS **ne signifie pas** que la candidature peut être déposée automatiquement. Les formulaires de candidature sur les sites externes restent à remplir manuellement lorsque nécessaire.

Les sources ne garantissent **ni l’exhaustivité ni la fraîcheur** des annonces : certaines peuvent être temporairement indisponibles ou ne proposer que peu d’alternances françaises. Voir la [matrice ATS](docs/ATS.md).

## Confidentialité

AlterRADAR suit une approche **local-first** : par défaut, le profil, les textes extraits des documents, les offres et le suivi sont stockés sur **ton ordinateur**, sans compte cloud AlterRADAR. Les demandes d’IA visent une instance Ollama locale (`127.0.0.1`).

**Points importants :**

- Les données utilisateur locales **ne sont pas chiffrées au repos** dans cette version.
- La recherche d’offres fait des requêtes aux services externes concernés, **sans leur transmettre le CV**.
- Si Telegram est activé, des alertes et éventuellement des documents peuvent transiter par **les serveurs Telegram**. Les discussions avec les bots ne sont pas des *Secret Chats* chiffrés de bout en bout.
- Les e-mails ne sont envoyés via SMTP qu’après configuration et validation ; un brouillon `.eml` peut aussi être généré localement.
- Les données personnelles importées ne doivent jamais être ajoutées au dépôt Git public.

Détails : [Politique de confidentialité](docs/PRIVACY.md) · [Configuration Telegram](docs/TELEGRAM.md).

## Développement

```bash
npm ci
npm run check:lock
npm test
npm run smoke:deps
npm run check:public
```

Construire localement (sur le système correspondant) :

```bash
npm run dist:mac  # macOS : .dmg + .zip
npm run dist:win  # Windows : installateur et version portable
```

Le workflow [GitHub Actions](.github/workflows/build-desktop.yml) permet de lancer les builds manuellement et lors de la création d’un tag `v*`. Les fichiers doivent être **testés avant publication de la release**.

## État du projet

La **v0.12.0** apporte notamment le compteur des offres compatibles, le filtrage Bac+N, une bibliothèque de modèles Qwen, le lien LinkedIn du créateur et les préférences d’apparence avec effet de verre teinté.

Les tests automatisés ne remplacent pas les essais réels sur plusieurs ordinateurs. Les recherches d’offres, les échanges avec Telegram/SMTP, les exports et l’import de certaines images doivent encore être validés dans les conditions d’utilisation finales. **Aucun dépôt de candidature ni recrutement n’est garanti.**

[Notes de version v0.12.0](CHANGELOG-v0.12.0.md) · [Guide de mise à jour](docs/MISE_A_JOUR_V0.12.md) · [Publication GitHub](docs/PUBLICATION_GITHUB.md)

## Contribuer

Les remontées de bugs et propositions d’amélioration sont bienvenues via les [Issues GitHub](https://github.com/AkshiiGIT/AlterRADAR/issues). Pour une contribution, ouvre une issue expliquant le besoin avant de proposer une modification importante.

**Ne partage pas de CV, de jetons Telegram, de mots de passe SMTP ni de clés API dans les issues ou les commits.**

## Créateur

**Créé et développé par Akasche MAHINTAN**

[GitHub](https://github.com/AkshiiGIT) · [LinkedIn](https://www.linkedin.com/in/akasche-mahintan) · [Contact professionnel](mailto:akasche.pro@gmail.com)

## Licence

AlterRADAR est un projet **gratuit et open source**, distribué sous licence [MIT](LICENSE).

<div align="center">
  <sub>© 2026 Akasche MAHINTAN · AlterRADAR — L’essentiel, sans le bruit.</sub>
</div>
