# AlterRADAR v0.9.0 — Interface adaptative

## Modifications

- Fenêtre Electron dimensionnée selon l’espace de travail réel; maximisation à l’ouverture quand la taille de l’écran le permet.
- Largeur minimale réduite pour les petits MacBook et Windows Snap.
- Zone de contenu utilisant toute la largeur disponible, avec défilement vertical unique; fin du défilement horizontal global.
- En dessous de 990 px, barre latérale compacte avec icônes et libellés accessibles au survol.
- Cartes et formulaires réorganisés sur une colonne sur les écrans étroits; boutons plus espacés et retours à la ligne contrôlés.
- Meilleurs espacements dans les listes d’offres, filtres, candidatures et paramètres.
- Meilleure accessibilité clavier et respect de la préférence de réduction des animations.

Aucune modification des paramètres IA, du profil, de Telegram ou des candidatures enregistrées.

## Limites de vérification

Les tests d'interface Chromium utilisent des données fictives. Le build Electron natif sur macOS et Windows doit encore être testé sur machines réelles.
