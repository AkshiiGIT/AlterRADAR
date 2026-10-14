# Confidentialité — AlterRADAR v0.5

Créé et développé par **Akasche MAHINTAN**. Application gratuite, code sous licence MIT.

## Données sur votre ordinateur

Le profil, les CV et lettres sources sous forme de textes extraits, les offres, les critères personnalisés, les textes IA, l'historique et les brouillons e-mail `.eml` sont stockés dans les données utilisateur de l'application sur **votre ordinateur**. Il n'existe pas de compte cloud AlterRADAR, de télémétrie intégrée ni de serveur hébergé par le créateur auquel vos fichiers seraient envoyés. Le créateur **n'a pas accès à vos données personnelles via AlterRADAR**.

**Avertissement** : dans cette version, le fichier JSON et les brouillons ne sont pas **chiffrés au repos**. Les jetons Telegram et les mots de passe SMTP sont stockés séparément en utilisant Electron `safeStorage` dans les limites de la protection du système d'exploitation. Une sauvegarde ou un ordinateur compromis peut révéler vos fichiers.

## Communications externes

| Action | Données transmises |
|---|---|
| Recherche d'offres Greenhouse/Lever | Requêtes réseau aux plateformes d'offres, sans transmettre les CV |
| IA Ollama locale | Textes envoyés uniquement à l'instance Ollama de `127.0.0.1` |
| Alertes Telegram activées | Informations sur les offres envoyées aux serveurs Telegram |
| Validation Telegram de documents activée | CV et lettre générés envoyés aux serveurs Telegram |
| Mode brouillon (.eml) | Aucun e-mail transmis au recruteur par AlterRADAR ; création d'un fichier local |
| Mode SMTP après validation | Texte et deux pièces jointes transmis au serveur du fournisseur e-mail puis au destinataire |

Les échanges avec des bots Telegram ne bénéficient pas du chiffrement de bout en bout des Secret Chats. Les politiques des plateformes tierces s'appliquent. Une copie locale supprimée **n'efface pas** les copies déjà envoyées à Telegram ni aux recruteurs.

## Coordonnées et assistance

Créateur : Akasche MAHINTAN. GitHub : https://github.com/akshiiGIT. E-mail : akasche.pro@gmail.com. Lien LinkedIn : à renseigner par le créateur avant distribution.

Cette description reflète l'architecture du code source ; elle ne constitue pas un audit de sécurité indépendant. Tester les échanges et les scénarios de suppression avant publication grand public.
