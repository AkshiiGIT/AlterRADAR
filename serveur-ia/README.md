# Assistant IA d’AlterRADAR : projet du module « Les Fondamentaux de l’IA » (ESGI 3IW)

Projet existant utilisé : **AlterRADAR**, application de bureau (Electron, Node.js) de recherche d’alternance.
Voie : **JavaScript (Node), sans dépendance npm** pour toute la partie IA.

Les trois fonctions du cours sont intégrées dans l’application (onglet **Assistant IA**) et
exposées aussi en HTTP par ce serveur, qui respecte le contrat de route du cours (`app/CONTRAT.md`).
Elles alimentent aussi un **chatbot disponible sur toutes les pages** (`lib/ia/chat.cjs`, route
`POST /api/chat` hors contrat), qui refuse tout ce qui sort du cadre de l’application.

## Architecture

```
Interface (renderer)  --IPC-->  Processus principal Electron  --+
                                                                 |--> lib/ia/  --HTTP-->  Ollama (localhost:11434)
Navigateur / tests    --HTTP--> serveur-ia/serveur.cjs  --------+
```

Le cœur `lib/ia/` est écrit une seule fois. Les deux transports se contentent d’acheminer ses
évènements : messages IPC pour l’application, SSE pour HTTP. L’interface ne contacte jamais
Ollama (sa politique de sécurité impose `connect-src 'none'`).

| Fichier | Séance | Rôle |
| --- | --- | --- |
| `lib/ia/modele.cjs` | 9 | client Ollama : streaming, appel classique, embeddings, timeout explicite |
| `lib/ia/resumer.cjs` | 9 | validation (TODO 1), prompt serveur (TODO 2), flux et clôture (TODO 3 à 5) |
| `lib/ia/assistant.cjs` | 10 | déclaration des outils (TODO 6), table explicite (TODO 7), boucle d’appel d’outil (TODO 8) |
| `lib/ia/recherche.cjs` | 12-13 | découpage sur les titres (TODO 9), vectorisation unique (TODO 10), cosinus (TODO 11), repli TF-IDF |
| `lib/ia/documents.cjs` | 13 | pipeline RAG, sources avant les fragments, refus hors corpus (TODO 12) |
| `lib/ia/chat.cjs` | 9, 10, 13 | chatbot : routeur à sortie JSON contrainte, puis résumé, outil, RAG, infos entreprise ou conseil ; refus fixe hors cadre |
| `lib/ia/commun.cjs` | | évènements, premier évènement consommé avant de répondre, journal |
| `serveur-ia/serveur.cjs` | | transport HTTP / SSE du contrat |
| `electron/main.cjs` | | transport IPC de l’application |

### Les données propres à AlterRADAR

| Fonction | Données |
| --- | --- |
| Résumer | une annonce d’alternance ou de stage, collée ou choisie parmi les offres enregistrées |
| Assistant (outils) | les offres et candidatures enregistrées dans AlterRADAR. Outils : `chercher_candidature` (entreprise, poste ou ville) et `bilan_candidatures` (comptes par statut) |
| Documents (RAG) | la documentation du dépôt : `README.md`, `INSTALLATION.md`, `docs/PRIVACY.md`, `docs/TELEGRAM.md`, `docs/ATS.md` (40 morceaux) |

## Règles communes du contrat

1. **Prompt côté serveur** : assemblé dans `lib/ia/*`. Le client n’envoie que `texte`, `ton` ou `question`.
2. **Entrées validées avant le modèle** : chaîne non vide, 20 000 caractères maximum pour un texte, 1 000 pour une question. Sinon, 400 en JSON.
3. **Timeout et repli** : 60 s par appel, 180 s par flux. Ollama injoignable : 503 avant le flux. Modèle d’embedding absent : repli sur une recherche par mots-clés.
4. **Journal** : chaque appel est noté (modèle, tokens d’entrée et de sortie, durée, issue), jamais le contenu. Il est visible dans l’onglet et dans la console du serveur.
5. **Rien n’est exposé** : messages d’erreur neutres, aucune trace d’exécution, aucune URL de modèle. Le serveur écoute sur `127.0.0.1`.

## Le cadre du chatbot

Le chatbot ne répond que sur l’alternance, les stages, la recherche d’emploi, le développement
informatique, les candidatures, les annonces et l’utilisation d’AlterRADAR. Trois barrières :

1. **Un routeur** classe chaque message dans l’une de six catégories : `resume_offre`, `entreprise`,
   `candidatures`, `aide_app`, `conseil` ou `hors_sujet`. Sa réponse est contrainte par un schéma JSON
   (`format` d’Ollama). `hors_sujet`, ou une réponse illisible, donne un refus fixe : aucun texte
   n’est généré. En cas de doute, on refuse.
2. **Une consigne par catégorie**, qui répète le cadre et la phrase de refus. Le résumé refuse un
   texte qui n’est pas une offre.
3. **Des faits venus d’AlterRADAR** : outils sur les candidatures, documentation du dépôt, annonces
   enregistrées. Pour une entreprise, seules ses annonces et le suivi des candidatures sont fournis,
   sans accès au web ni connaissances du modèle.

L’interface envoie le message et, au plus, l’identifiant de l’offre ouverte. L’historique (3 échanges)
est gardé dans le processus principal, jamais renvoyé par le client.

Garde-fous supplémentaires :

- Le texte et la question restent dans un message `user` séparé de la consigne.
- Les arguments des outils sont validés et le nom de l’outil est cherché dans une table explicite. Un outil inconnu donne une erreur, renvoyée au modèle.
- Les CV et lettres ne sont jamais transmis au modèle.
- Si aucun extrait n’atteint le seuil de similarité, le refus est déterministe et le modèle n’est pas appelé.

## Lancer

```bash
ollama pull qwen2.5:3b
ollama pull paraphrase-multilingual
npm run ia:serveur                     # http://127.0.0.1:3000, candidatures de démonstration
ALTERRADAR_DONNEES="$HOME/Library/Application Support/AlterRADAR/radar-data.json" npm run ia:serveur   # tes vraies données (macOS)
FRONT_DIR=../cours-ia-3iw/cours-ia/app/front npm run ia:serveur   # servir le front gelé du cours
npm run ia:chercher -- "comment activer les alertes Telegram ?"   # la recherche seule, sans génération
```

Réglages : `PORT`, `OLLAMA_BASE_URL`, `MODEL_BASE` (défaut `qwen2.5:3b`), `MODEL_EMBED`
(défaut `paraphrase-multilingual`), `DELAI_MODELE` (secondes), `IA_SEUIL` (défaut `0.25`).

## Vérifier

```bash
npm test                               # 205 tests, dont 28 pour l’assistant et le chatbot (faux Ollama, aucun modèle requis)

# Suite de conformité du cours, depuis le dépôt du cours, ce serveur lancé sur le port 3000 :
make conformite
```

Résultat avec la suite officielle (`EXIGER=1`) : **34 tests sur 35 passent**, mode dégradé compris.
Le seul échec est `test_l_outil_est_reellement_appele`. Ce test demande la commande `CMD-2024-118`,
une donnée qui n’existe que dans le projet fil rouge du cours. Dans AlterRADAR, l’outil interroge des
candidatures. Il est bien appelé, mais répond que la commande est introuvable. Le même comportement
est vérifié avec les données d’AlterRADAR dans `tests/ia-assistant.test.cjs`.
