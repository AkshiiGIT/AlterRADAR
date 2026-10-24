# Détection des systèmes de recrutement (ATS)

**Cette version identifie 30 familles d'ATS à partir du domaine d'une URL de candidature.**
Une identification n'est **pas** un connecteur de recherche et ne signifie jamais qu'une candidature est déposée. Les URL hébergées sur des domaines personnalisés ne révèlent pas toujours leur logiciel de recrutement ; le résultat peut donc rester « ATS non identifié ».

## Algorithme

1. Lorsqu'une annonce est récupérée via une des API d'emploi intégrées, AlterRADAR analyse **l'URL HTTPS exacte** de candidature et vérifie des domaines ATS (pas de simple recherche de mots-clés dans l'adresse ; protection contre `jobs.lever.co.evil.example`).
2. L'ATS identifié apparaît dans la liste et dans la fiche de l'annonce. L'ancien historique des candidatures est conservé.
3. Si ce lien contient un identifiant public de tableau employeur pour l'un des **9 connecteurs expérimentaux**, AlterRADAR peut consulter les autres offres actuellement publiées sur ce tableau automatiquement, dans une limite de 6 tableaux par scan et avec une temporisation de 6 heures par tableau.
4. Les annonces supplémentaires repassent par **tous les filtres candidat** (alternance, niveau Bac+N, exclusion écoles privées, règles personnalisées) et le dédoublonnage avant notification.
5. Les e-mails de candidature sont détectés uniquement s'ils sont **explicitement publiés dans l'annonce**. Aucune adresse RH, personnelle ou professionnelle, n'est construite à partir d'un nom ou d'un profil LinkedIn.

### Connecteurs publics programmés (9)

| ATS | Interface | Limitations |
|---|---|---|
| Workday Recruiting | Flux POST non officiel `/wday/cxs/{tenant}/{site}/jobs` | Fonctionne selon la configuration du site ; 200 postes maximum par balayage ; la description peut manquer |
| Greenhouse | Board API | Nécessite un lien de tableau d'entreprise découvert |
| Lever | Postings API | Nécessite un tableau d'entreprise découvert |
| SmartRecruiters | Public Posting API | Résultats paginés ; la première page de 100 est actuellement consultée |
| Ashby | Public Job Posting API | Les offres `isListed: false` sont ignorées |
| Teamtailor | Endpoint public JSON observé | Disponibilité variable selon les sites et évolutions du fournisseur |
| Recruitee (Tellent) | Endpoint du site carrière | Disponibilité variable selon la configuration |
| Workable | Widget public | Les descriptions complètes peuvent varier selon l'employeur |
| Breezy HR | JSON de site carrière | Format et accessibilité variables selon l'employeur |

**Attention :** ces connecteurs ont passé des tests avec des réponses simulées, pas des essais complets en production sur des entreprises réelles. Ils peuvent retourner une erreur ou aucun poste. AlterRADAR ne contourne pas les connexions, CAPTCHAs, limites d'accès, ou mesures anti-robots. L'application n'a pas de recherche globale dans tous les comptes employeurs de ces 9 services : elle **découvre un tableau lorsqu'une offre de ce tableau est déjà accessible par une API d'emploi**.

### ATS actuellement reconnus par leur URL uniquement (21)

Oracle Taleo ; SAP SuccessFactors Recruiting ; iCIMS ; Bullhorn ; Avature ; Flatchr ; Taleez ; Beetween ; Welcome to the Jungle Solutions ATS ; Softgarden ; Jobaffinity ; WeRecruit ; Layan ; Tool4staffing ; Nicoka CABS ; Beehire ; BambooHR ; Zoho Recruit ; JazzHR ; Bizneo HR ; Eurécia (Gestion des talents).

Le moteur conserve leur URL officielle et la source, mais **n'aspire pas automatiquement tous les emplois de ces ATS**. Certains disposent d'interfaces spécifiques à l'entreprise, d'API réservées aux clients, ou de pages sans contrat de lecture stable. Les prochains connecteurs devront être ajoutés et testés **fournisseur par fournisseur**.

## Confidentialité / sécurité

- Les règles et candidatures restent sur le PC, comme auparavant. Les appels API envoient les requêtes aux fournisseurs d'offres concernés ; Telegram reçoit seulement les messages et pièces jointes autorisés par l'utilisateur.
- Aucun navigateur Chromium externe n'est nécessaire : l'interface utilise Electron. Les tests unitaires ne garantissent pas la compatibilité de tous les sites ATS réels.
- Les URL fournies par des annonces ne sont pas récupérées librement par le moteur d'extension : seuls les domaines publics ATS et endpoints autorisés sont interrogés, avec redirections désactivées.
- Les liens indirects d'agrégateurs et les domaines employeurs personnalisés ne sont pas toujours reconnaissables ; leur résolution complète nécessite une fonctionnalité de redirection contrôlée, non incluse dans cette version.

## Vérification technique

`npm test` exécute les tests de reconnaissance des 30 ATS, de rejet des faux domaines, de déduplication et de récupération simulée des tableaux publics. Aucune requête en production n'est déclenchée par ces tests.

Documentation utile :
- [Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html)
- [Ashby Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api)
- [SmartRecruiters Public Posting API](https://developers.smartrecruiters.com/docs/posting-api)
