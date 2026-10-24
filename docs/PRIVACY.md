# Confidentialité

AlterRADAR est une application gratuite sous licence MIT, créée et développée par **Akasche MAHINTAN**. Ce document décrit ce que fait le code source ; il ne remplace pas un audit de sécurité indépendant.

## Données enregistrées sur ton ordinateur

Le profil, le texte extrait du CV et de la lettre, les offres, les règles de tri, les documents générés, l’historique des candidatures et les brouillons e-mail `.eml` sont enregistrés localement :

| Système | Dossier |
|---|---|
| Windows | `%APPDATA%\AlterRADAR` |
| macOS | `~/Library/Application Support/AlterRADAR` |

On y trouve `radar-data.json` (données principales), `drafts/` (brouillons `.eml`), `candidate-backups/` (archives créées lors d’un changement de candidat) et l’éventuel fond d’écran importé.

Il n’existe ni compte AlterRADAR, ni serveur central, ni télémétrie. Le créateur n’a aucun accès à tes données.

Ces fichiers **ne sont pas chiffrés au repos**. Les secrets (jeton Telegram, mot de passe SMTP, clés API France Travail, Adzuna, Jooble et La bonne alternance) sont chiffrés séparément avec le coffre du système via Electron `safeStorage` (DPAPI sous Windows, trousseau sous macOS). Une sauvegarde non protégée ou un compte utilisateur compromis peut exposer le reste des données : protège ta session.

Pour tout effacer : quitte AlterRADAR (**Quitter complètement** si la surveillance est active) puis supprime le dossier ci-dessus.

## Ce qui sort de ton ordinateur

| Action | Destinataire | Données transmises |
|---|---|---|
| Recherche d’offres | Plateformes d’emploi activées (France Travail, Adzuna, Arbeitnow, Remotive…) et tableaux ATS publics | Mots-clés de métier, villes et rayons, identifiants API si tu les as fournis. Jamais le CV ni la lettre. |
| Zones géographiques et tri par distance | `geo.api.gouv.fr` | Noms de communes uniquement |
| Vérification des dates de publication | Site de l’annonce | Une requête vers la page publique de l’offre, sans donnée personnelle |
| IA (profil, CV, lettre) | Ollama sur ton ordinateur (`127.0.0.1`) | CV, lettre, profil et annonce ; rien ne sort de la machine |
| Alertes Telegram (si activées) | Serveurs Telegram | Titre, entreprise, lieu, extrait et lien des offres |
| Validation Telegram (si activée) | Serveurs Telegram | CV et lettre générés au format `.docx` |
| Envoi SMTP (si configuré et validé) | Ton fournisseur e-mail, puis le recruteur | E-mail et deux pièces jointes |
| Relais La bonne alternance (si déployé) | Cloudflare puis l’API La bonne alternance | Ville, rayon, codes métier |

Les conversations avec un bot Telegram ne sont pas chiffrées de bout en bout. Les politiques de confidentialité des services tiers s’appliquent. Supprimer une donnée locale n’efface pas les copies déjà envoyées à Telegram ou à un recruteur.

## Contact

Créateur : Akasche MAHINTAN · [GitHub](https://github.com/AkshiiGIT) · [LinkedIn](https://www.linkedin.com/in/akasche-mahintan) · akasche.pro@gmail.com

Faille de sécurité : voir [SECURITY.md](../SECURITY.md).
