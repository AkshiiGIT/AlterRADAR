# AlterRADAR v0.10.0 — Version candidate pour tests publics

- Recherche ciblée par les métiers déduits du CV : un poste assistant RH / recruteur IT / business developer ne passe plus par défaut dans le flux d'un développeur web ou full-stack. Recherche élargie désactivable dans les règles. Score explicable fondé d'abord sur la famille du poste, puis les technologies et le cursus.
- Les requêtes des moteurs de recherche sont spécialisées « stage/alternance + métier » au lieu d'un terme de contrat uniquement.
- Génération de CV et lettres ATS avec deux maquettes à une seule colonne ; identité, coordonnées, sections, hiérarchie typographique et espaces adaptés.
- **Une page A4 pour CV et lettre** : choix de densité d'impression lisible ; sortie trop longue refusée plutôt que tronquée silencieusement. Lorsque le modèle génère un texte trop long, une réécriture plus courte est demandée une fois avant de retourner une erreur.
- Le moteur PDF mesure les blocs avec PDFKit avant écriture et vérifie le nombre de pages. Le moteur DOCX applique les mêmes choix de densité via une estimation conservatrice. Un contrôle visuel reste requis sur les plateformes cibles pour garantir la pagination Word.
- Interface responsive de v0.9 conservée : 42 combinaisons de pages et fenêtres testées (6 dimensions × 7 écrans).
- Documentation de premier `git push`, script de vérification des fichiers indexés et compilation CI Windows/macOS.

Limites : certaines sources externes nécessitent des clés ou ne proposent pas d'offres adaptées en France. Les tests simulés n'assurent pas la livraison Telegram/SMTP ni la possibilité de candidater via tous les ATS. Les installateurs ne sont pas fournis précompilés dans l'archive source.
