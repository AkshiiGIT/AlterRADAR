# Relais La bonne alternance pour AlterRADAR v0.13

Le relais Cloudflare Worker permet à tous les utilisateurs d'AlterRADAR de rechercher des **offres d'apprentissage** sans recevoir la clé privée de l'administrateur. Il est **en lecture seule** et n'accepte ni CV, ni lettre de motivation, ni nom, ni courriel, ni jeton Telegram. Il ne transmet à La bonne alternance que des critères de recherche (commune, rayon, codes ROME optionnels).

⚠️ **Un fichier Worker n'est pas un serveur déployé**. Le relais ne sera disponible à tous qu'une fois publié sur un compte Cloudflare, avec une clé de **production** La bonne alternance, et son adresse HTTPS définie dans `config/public-services.json`. **N'ajoute jamais ta clé dans le JSON ni dans le dépôt Git.**

## Déployer sur Cloudflare

1. Créer un compte Cloudflare, se connecter avec `npx wrangler login` sur une machine disposant de Node.js. 
2. Dans le dossier `relay`, lancer `npx wrangler secret put LBA_API_KEY` : saisir ta clé API **uniquement dans le terminal sécurisé** (ne pas la partager).
3. Déployer avec `npx wrangler deploy` depuis `relay` et relever l'adresse `https://...workers.dev` renvoyée.
4. Tester `https://...workers.dev/health` puis `https://...workers.dev/v1/offers?city=Paris&radiusKm=20`. Vérifier le résultat avec tes propres tests et la documentation de l'API.
5. Ajouter **l'URL du Worker**, sans secret, dans `config/public-services.json`, champ `alternanceRelayUrl` (l'URL doit être le domaine HTTPS du Worker, sans chemin).
6. Relancer tests et compilations Electron. La nouvelle version activera alors la source La bonne alternance par défaut pour les **nouveaux** profils ; les profils existants peuvent l'activer dans « Sources automatiques ».

## Sécurité et disponibilité

- Le secret réside uniquement dans la configuration `LBA_API_KEY` du Worker, pas dans l'application ou le dépôt.
- Cache par ville/rayon/codes ROME : 10 minutes. Ce cache aide les quotas mais ne remplace pas une protection anti-abus.
- Ajouter une **règle de limitation de débit Cloudflare WAF** et surveiller les métriques ; un point d'accès public ne peut empêcher les abus par magie. Selon la fréquentation, privilégier une limite globale plus stricte et contacter l'équipe API pour discuter des quotas.
- Le backend ne fait **aucun envoi de candidature**. Les candidatures restent préparées localement puis validées par l'utilisateur.
- La bonne alternance annonce un accès gratuit **pour usage non lucratif** : vérifier la licence et les obligations de redistribution / attribution avant lancement grand public. Ne pas revendre ces données.
- Le Worker peut être désactivé en retirant la configuration et en republiant l'application. Les recherches par autres sources restent disponibles.
- Une clé personnelle peut toujours être configurée localement dans AlterRADAR.
- Ce service n'est pas une protection absolue contre le suivi des requêtes : Cloudflare et l'API reçoivent les villes et métiers demandés et Cloudflare traite les IP. Il n'envoie pas les fichiers du candidat.

## Validation nécessaire

Le code a des tests simulés. Une validation avec vraie clé **sans partager sa valeur** est obligatoire pour confirmer le format des réponses et l'exhaustivité des offres. Ne pas annoncer « toutes les offres » ou « serveur actif » avant ce test.
