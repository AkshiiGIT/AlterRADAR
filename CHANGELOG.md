# Historique des versions

Toutes les versions d’AlterRADAR, de la plus récente à la plus ancienne.
Créé et développé par **Akasche MAHINTAN** · licence MIT.

## v0.14.0 — Première version publique

### Windows et macOS

- Une seule instance de l’application à la fois : relancer AlterRADAR rouvre la fenêtre existante au lieu de démarrer un second processus qui écrirait les mêmes données.
- Notifications Windows fiables : identifiant d’application aligné sur celui de l’installateur.
- Icône de zone de notification adaptée à chaque système : icône monochrome « Template » dans la barre des menus macOS (claire ou sombre), `.ico` multi-tailles sous Windows. Un clic gauche rouvre la fenêtre sous Windows.
- macOS : la fenêtre peut être déplacée en la saisissant par le haut (barre de titre intégrée) et les boutons fermer/réduire/agrandir ne chevauchent plus la barre latérale. Un clic sur l’icône du Dock rouvre une fenêtre masquée.
- Windows : suppression du menu Electron par défaut (Aide vers electronjs.org, outils de développement).
- Démarrage avec la session : sous Windows, AlterRADAR démarre directement dans la zone de notification lorsque la surveillance est active. La version portable enregistre le bon exécutable.
- Première fermeture avec surveillance active : une notification explique qu’AlterRADAR continue en arrière-plan et comment le quitter.
- Import de CV en PDF corrigé sur Mac Intel et Windows ARM : la lecture ne dépend plus d’un module natif absent sur ces architectures.
- Réseaux d’école ou d’entreprise : les autorités de certification installées dans Windows ou macOS sont acceptées en plus de celles de Node.js.
- Export PDF : la police Arial est cherchée dans le vrai dossier Windows (`%WINDIR%`), et un export interrompu ne laisse plus de fichier vide.
- Lanceurs « depuis les sources » : `Lancer-AlterRADAR.bat` en fins de ligne Windows (CRLF), détection d’une installation Electron incomplète.

### Sécurité

- Electron 44.9.3 : corrige une vulnérabilité élevée (certificats intermédiaires eMudhra compromis, [GHSA-jr5w-w6x2-84p9](https://github.com/advisories/GHSA-jr5w-w6x2-84p9)).
- Nodemailer 10.1.7 : corrige l’analyse des adresses e-mail (avis de sécurité d’octobre 2026).
- La CI audite aussi Electron (`npm run audit:electron`) : livré dans l’application, il échappait à `npm audit --omit=dev`.

### Documents

- Les métadonnées des CV et lettres exportés (DOCX et PDF) portent le nom du candidat. Elles affichaient auparavant le nom du créateur d’AlterRADAR, visible par les recruteurs dans les propriétés du fichier.

### Publication

- Installateurs Windows nommés sans collision, un par architecture : `…-Windows-x64-Setup.exe`, `…-Windows-x64-Portable.exe` et leurs équivalents `arm64`. L’installateur et la version portable portaient le même nom et l’un écrasait l’autre.
- macOS : signature « ad hoc » des applications. Sans certificat Apple, cela évite le message « AlterRADAR est endommagé » sur Mac Apple Silicon (un avertissement Gatekeeper reste normal).
- Mode `--self-test` : chaque application construite par GitHub Actions est lancée sur Windows et macOS pour vérifier la génération DOCX/PDF, la lecture PDF, le brouillon e-mail, l’icône et l’affichage de l’interface.
- Nouveau workflow de tests sur Windows et macOS à chaque push et pull request.
- Autotest macOS en CI : trousseau simulé (`--use-mock-keychain`, comme les tests d’Electron) pour éviter la fenêtre d’accès au trousseau qui bloquait le build, et 4 minutes maximum par application avec l’étape en cours indiquée dans le rapport.
- La Release ne contient que les installateurs et `SHA256SUMS.txt`, sans les dossiers décompressés.
- `.gitattributes` pour des fins de ligne identiques quel que soit le système du contributeur.
- Documentation réécrite : README, guide d’installation, procédure de publication, politique de sécurité.

### Interface : Pure White et Twilight Purple

- Pure White : interface claire noir et blanc par défaut pour une nouvelle installation.
- Twilight Purple : thème sombre noir profond, anthracite et reflets violets.
- Frosted Glass : rendu clair dépoli, optionnel.
- Trois cartes de prévisualisation dans **Paramètres → Apparence personnalisée**, choix sauvegardé localement.
- Reflets qui suivent le pointeur sur les boutons, micro-animations désactivées par « Réduire les effets » et par la préférence système de réduction des mouvements.

### Dates des offres

- Une date de publication documentée par une API reste prioritaire.
- Annonces `jobs.ashbyhq.com` : lecture de l’API publique du tableau, avec comparaison de l’URL et du titre avant d’accepter la date.
- `updatedAt`, `dateModified`, la date d’import ou la date de début de contrat ne sont jamais présentées comme une date de publication.
- Aucun CV ni lettre n’est transmis aux services de vérification des dates.

### CV sur une page A4

- Ollama rédige un CV ciblé puis peut le condenser deux fois en retirant du document adapté les expériences sans rapport avec l’annonce. Le CV importé reste inchangé.
- Après trois essais infructueux, le problème est expliqué sans écraser le document précédent.
- Surveillance par défaut toutes les cinq minutes ; les API soumises à des quotas sont interrogées moins souvent.

## v0.13.4 — Navigation, tri et identité visuelle

- Les onglets restent utilisables pendant une analyse Ollama ; seules les actions concurrentes sont bloquées.
- Tri des offres par pertinence, date de publication ou distance approximative (centres de communes via `geo.api.gouv.fr`, noms de villes uniquement).
- Formulaire multi-villes repliable sur la page des offres.
- Thème clair noir et blanc par défaut pour les nouveaux profils, thème sombre anthracite et violet.

## v0.13.3 — Interface et diagnostic Telegram

- Recherche par cartes de villes : rayon 0–100 km, jusqu’à 12 villes.
- Thème Apple Light, nuancier de teintes, option « Réduire les effets visuels ».
- Bouton **Vérifier ma connexion** Telegram (`getMe`, `getChat`) sans envoi de message ni de document.

## v0.13.2 — Mise à jour cumulative v0.13

- GitHub Actions sur Node.js 24, Release créée en brouillon.
- Fonds d’écran validés par signature de fichier, conversion locale en JPG au-delà de 8 Mo.
- Changement de candidat : confirmation, archivage local du profil précédent, documents générés invalidés.

## v0.13.0 et v0.13.1 — Recherche multi-zones

- Jusqu’à 12 zones avec rayon, choix du secteur d’activité.
- Recherche localisée France Travail (codes INSEE) et Adzuna ; Jooble par ville sans promesse de rayon.
- Diagnostic par source : annonces reçues, compatibles, exclues, erreurs.
- `npm run diagnose:sources` pour tester les sources sans clé.
- Relais Cloudflare facultatif pour La bonne alternance (code fourni, non déployé).

## v0.12.0 — Cohérence, modèles IA et apparence

- Compteur « Offres & stages » aligné sur les offres affichées.
- Contrôle du niveau Bac+N issu du profil, actif par défaut.
- Six modèles Qwen proposés, téléchargés uniquement après un clic.
- Thèmes, fonds d’écran locaux et panneaux translucides.

## v0.11.0 — Modernisation

- Electron 44, electron-builder 26, pdf-parse 2, nodemailer 10.
- Tests de fumée des vrais formats DOCX, PDF et EML en CI.
- Échelle d’espacement unifiée.

## v0.10.0 — Version candidate

- Recherche ciblée par les métiers déduits du CV, score explicable.
- CV et lettres ATS sur une colonne, une page A4.

## v0.9.0 — Interface adaptative

- Fenêtre dimensionnée selon l’écran, barre latérale compacte sous 990 px.

## v0.7.0 — Simplification de la recherche

- Import du CV au démarrage, analyse du profil, scan immédiat.
- Source communautaire « Alternances Tech France ».

## v0.6.1 — Détection ATS

- Identification de 30 ATS à partir de l’URL des annonces, 9 connecteurs publics expérimentaux.

## v0.5.1 — Correctif de surveillance

- Correction de l’enregistrement de la case « Activer la surveillance en arrière-plan ».
