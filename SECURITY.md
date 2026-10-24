# Politique de sécurité

## Versions suivies

Seule la dernière version publiée sur la page [Releases](https://github.com/AkshiiGIT/AlterRADAR/releases/latest) reçoit des correctifs de sécurité.

## Signaler une faille

N’ouvre pas d’issue publique pour une faille de sécurité. Utilise plutôt :

- l’onglet **Security → Report a vulnerability** du dépôt (signalement privé GitHub), ou
- un e-mail à akasche.pro@gmail.com avec « AlterRADAR sécurité » dans l’objet.

Décris la version concernée, ton système (Windows ou macOS), les étapes pour reproduire le problème et son impact. N’inclus jamais de vrai CV, jeton Telegram, mot de passe ou clé API : des données fictives suffisent.

Tu recevras une réponse sous 7 jours. Une fois le correctif publié, la faille pourra être décrite dans le [CHANGELOG](CHANGELOG.md), avec ton nom si tu le souhaites.

## Périmètre

AlterRADAR fonctionne entièrement sur l’ordinateur de l’utilisateur. Sont particulièrement utiles les signalements concernant :

- l’exécution de code ou la lecture de fichiers locaux à partir d’une annonce, d’un CV ou d’une réponse d’API ;
- la fuite de données locales (CV, profil, jetons) vers un service tiers sans action de l’utilisateur ;
- le contournement de la validation Telegram avant un envoi ;
- le relais Cloudflare du dossier `relay/`.

Les avertissements Windows SmartScreen et macOS Gatekeeper liés à l’absence de certificat payant sont connus et documentés dans [INSTALLATION.md](INSTALLATION.md).
